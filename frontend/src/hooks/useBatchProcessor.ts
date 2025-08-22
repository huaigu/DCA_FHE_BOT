import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { useContract, useContractRead, useContractWrite } from './useContract';
import { useWalletStore } from '@/lib/store';
import { SEPOLIA_CONTRACTS } from '@/config/contracts';
import BatchProcessorABI from '@/config/abis/BatchProcessor.json';

export interface WithdrawalRequest {
  requestId: string;
  user: string;
  timestamp: number;
  processed: boolean;
}

export interface EthBalance {
  encrypted: string;
  isInitialized: boolean;
}

export function useBatchProcessor() {
  const { address } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUsdcWithdrawal, setPendingUsdcWithdrawal] = useState<string | null>(null);
  const [pendingEthWithdrawal, setPendingEthWithdrawal] = useState<string | null>(null);

  // Contract instance
  const contract = useContract(
    SEPOLIA_CONTRACTS.BATCH_PROCESSOR,
    BatchProcessorABI,
    true // with signer for write operations
  );

  // Read user's encrypted ETH balance
  const {
    data: encryptedEthBalance,
    isLoading: isEthBalanceLoading,
    refetch: refetchEthBalance
  } = useContractRead<string>(
    contract,
    'encryptedEthBalances',
    address ? [address] : [],
    false // temporarily disabled
  );

  // Check if user is currently withdrawing
  const {
    data: isWithdrawing,
    refetch: refetchWithdrawingStatus
  } = useContractRead<boolean>(
    contract,
    'isWithdrawing',
    address ? [address] : [],
    false // temporarily disabled
  );

  // Get active USDC withdrawal request
  const {
    data: activeUsdcRequest,
    refetch: refetchUsdcRequest
  } = useContractRead<string>(
    contract,
    'activeUsdcWithdrawalRequest',
    address ? [address] : [],
    false // temporarily disabled
  );

  // Get active ETH withdrawal request
  const {
    data: activeEthRequest,
    refetch: refetchEthRequest
  } = useContractRead<string>(
    contract,
    'activeEthWithdrawalRequest',
    address ? [address] : [],
    false // temporarily disabled
  );

  // Get total ETH balance in BatchProcessor - we'll handle this differently
  const [totalEthBalance, setTotalEthBalance] = useState<bigint>(BigInt(0));
  
  const refetchTotalEthBalance = useCallback(async () => {
    if (contract?.runner?.provider) {
      try {
        const balance = await contract.runner.provider.getBalance(SEPOLIA_CONTRACTS.BATCH_PROCESSOR);
        setTotalEthBalance(balance);
      } catch (error) {
        console.error('Failed to get BatchProcessor ETH balance:', error);
      }
    }
  }, [contract]);

  // Contract write functions
  const { writeAsync: initiateUsdcWithdrawalAsync } = useContractWrite(contract, 'initiateUsdcWithdrawal');
  const { writeAsync: withdrawEthAsync } = useContractWrite(contract, 'withdrawEth');

  /**
   * Initiate USDC withdrawal (step 1 of 2-step process)
   */
  const initiateUsdcWithdrawal = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tx = await initiateUsdcWithdrawalAsync([]);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Extract request ID from events if possible
      const requestId = receipt.logs?.[0]?.topics?.[1] || Date.now().toString();
      setPendingUsdcWithdrawal(requestId);
      
      // Refresh status
      await Promise.all([
        refetchWithdrawingStatus(),
        refetchUsdcRequest()
      ]);

      return receipt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'USDC withdrawal initiation failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [initiateUsdcWithdrawalAsync, refetchWithdrawingStatus, refetchUsdcRequest]);

  /**
   * Initiate ETH withdrawal (step 1 of 2-step process)
   */
  const withdrawEth = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tx = await withdrawEthAsync([]);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Extract request ID from events if possible
      const requestId = receipt.logs?.[0]?.topics?.[1] || Date.now().toString();
      setPendingEthWithdrawal(requestId);
      
      // Refresh status
      await Promise.all([
        refetchWithdrawingStatus(),
        refetchEthRequest(),
        refetchEthBalance()
      ]);

      return receipt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ETH withdrawal failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [withdrawEthAsync, refetchWithdrawingStatus, refetchEthRequest, refetchEthBalance]);

  /**
   * Check if withdrawal is complete by polling contract state
   */
  const checkWithdrawalStatus = useCallback(async () => {
    if (!address) return;

    try {
      await Promise.all([
        refetchWithdrawingStatus(),
        refetchUsdcRequest(), 
        refetchEthRequest()
      ]);

      // Note: Actual status checking logic will be implemented 
      // when contract read functions are properly enabled
    } catch (error) {
      console.error('Error checking withdrawal status:', error);
    }
  }, [address, refetchWithdrawingStatus, refetchUsdcRequest, refetchEthRequest]);

  /**
   * Refresh all balance and status data
   */
  const refreshAll = useCallback(async () => {
    await Promise.all([
      refetchEthBalance(),
      refetchWithdrawingStatus(),
      refetchUsdcRequest(),
      refetchEthRequest()
    ]);
    // Call ETH balance refresh separately as it's async
    await refetchTotalEthBalance();
  }, [refetchEthBalance, refetchWithdrawingStatus, refetchUsdcRequest, refetchEthRequest, refetchTotalEthBalance]);

  // Initial load of ETH balance
  useEffect(() => {
    refetchTotalEthBalance();
  }, [refetchTotalEthBalance]);

  /**
   * Get ETH balance info
   */
  const ethBalance: EthBalance = {
    encrypted: encryptedEthBalance || '0',
    isInitialized: !!(encryptedEthBalance && encryptedEthBalance !== '0')
  };

  return {
    // Contract state
    contract,
    
    // Balance info
    ethBalance,
    totalEthBalance,
    isEthBalanceLoading,
    
    // Withdrawal status
    isWithdrawing: isWithdrawing || false,
    pendingUsdcWithdrawal,
    pendingEthWithdrawal,
    activeUsdcRequest: activeUsdcRequest || '0',
    activeEthRequest: activeEthRequest || '0',
    
    // Actions
    initiateUsdcWithdrawal,
    withdrawEth,
    checkWithdrawalStatus,
    
    // Loading states
    isLoading,
    error,
    
    // Utilities
    refreshAll,
    
    // Contract availability
    isReady: !!contract && !!address
  };
}