import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useContract, useContractRead, useContractWrite } from './useContract';
import { useWalletStore } from '@/lib/store';
import { SEPOLIA_CONTRACTS } from '@/config/contracts';
import { encryptAmount } from '@/utils/fheEncryption';
import FundPoolABI from '@/config/abis/FundPool.json';

export interface FundPoolBalance {
  encrypted: string;
  isInitialized: boolean;
}

export function useFundPool() {
  const { address } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contract instance
  const contract = useContract(
    SEPOLIA_CONTRACTS.FUND_POOL,
    FundPoolABI,
    true // with signer for write operations
  );

  // Read user balance
  const {
    data: balanceData,
    isLoading: isBalanceLoading,
    refetch: refetchBalance
  } = useContractRead<[string, boolean]>(
    contract,
    'getEncryptedBalance',
    address ? [address] : [],
    !!address
  );

  // Check if balance is initialized
  const {
    data: isInitialized,
    refetch: refetchInitialized
  } = useContractRead<boolean>(
    contract,
    'isBalanceInitialized',
    address ? [address] : [],
    !!address
  );

  // Get total pool balance
  const {
    data: totalPoolBalance,
    refetch: refetchTotalBalance
  } = useContractRead<bigint>(
    contract,
    'getTotalPoolBalance',
    [],
    true
  );

  // Contract write functions
  const { writeAsync: depositAsync } = useContractWrite(contract, 'deposit');
  const { writeAsync: withdrawAsync } = useContractWrite(contract, 'withdraw');

  /**
   * Deposit USDC to the fund pool
   */
  const deposit = useCallback(async (
    amount: bigint,
    contractAddress: string,
    userAddress: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Encrypt the amount for privacy
      const { encryptedData, proof } = await encryptAmount(
        amount,
        contractAddress,
        userAddress
      );

      // Call deposit function with encrypted amount and plaintext for USDC transfer
      const tx = await depositAsync([
        encryptedData,
        proof,
        amount.toString() // plaintext amount for USDC transfer (temporary solution)
      ]);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Refresh balance data
      await Promise.all([
        refetchBalance(),
        refetchInitialized(),
        refetchTotalBalance()
      ]);

      return receipt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Deposit failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [depositAsync, refetchBalance, refetchInitialized, refetchTotalBalance]);

  /**
   * Withdraw USDC from the fund pool
   */
  const withdraw = useCallback(async (
    amount: bigint,
    proof: string = '0x' // Simplified proof for demo
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Call withdraw function
      const tx = await withdrawAsync([
        amount.toString(),
        proof
      ]);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Refresh balance data
      await Promise.all([
        refetchBalance(),
        refetchTotalBalance()
      ]);

      return receipt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Withdrawal failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [withdrawAsync, refetchBalance, refetchTotalBalance]);

  /**
   * Format balance for display
   */
  const formatBalance = useCallback((encrypted: string): string => {
    // In a real implementation, this would decrypt the balance
    // For demo purposes, we'll show placeholder
    return encrypted ? '[Encrypted Balance]' : '0';
  }, []);

  /**
   * Get current user balance info
   */
  const balance: FundPoolBalance = {
    encrypted: balanceData?.[0] || '0',
    isInitialized: isInitialized || false
  };

  return {
    // Contract state
    contract,
    
    // Balance info
    balance,
    totalPoolBalance: totalPoolBalance || 0n,
    isBalanceLoading,
    
    // Actions
    deposit,
    withdraw,
    
    // Loading states
    isLoading,
    error,
    
    // Utilities
    formatBalance,
    refetchBalance,
    refetchTotalBalance,
    
    // Contract availability
    isReady: !!contract && !!address
  };
}