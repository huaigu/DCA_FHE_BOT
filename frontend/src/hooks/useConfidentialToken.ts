import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useContract, useContractRead, useContractWrite } from './useContract';
import { useWalletStore } from '@/lib/store';
import { SEPOLIA_CONTRACTS } from '@/config/contracts';
import ConfidentialTokenABI from '@/config/abis/ConfidentialToken.json';

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

export interface ConfidentialBalance {
  encrypted: string;
  isInitialized: boolean;
}

export function useConfidentialToken() {
  const { address } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contract instance
  const contract = useContract(
    SEPOLIA_CONTRACTS.CONFIDENTIAL_TOKEN,
    ConfidentialTokenABI,
    true // with signer for write operations
  );

  // Get token info
  const { data: name } = useContractRead<string>(
    contract,
    'name',
    [],
    true
  );

  const { data: symbol } = useContractRead<string>(
    contract,
    'symbol',
    [],
    true
  );

  const { data: decimals } = useContractRead<number>(
    contract,
    'decimals',
    [],
    true
  );

  // Get user's encrypted balance
  const {
    data: encryptedBalance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance
  } = useContractRead<string>(
    contract,
    'balanceOf',
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

  // Contract write functions
  const { writeAsync: initializeBalanceAsync } = useContractWrite(contract, 'initializeBalance');
  const { writeAsync: withdrawAsync } = useContractWrite(contract, 'withdraw');
  const { writeAsync: encryptedTransferAsync } = useContractWrite(contract, 'encryptedTransfer');

  /**
   * Initialize encrypted balance for the user
   */
  const initializeBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tx = await initializeBalanceAsync([]);
      const receipt = await tx.wait();
      
      // Refresh initialization status
      await refetchInitialized();
      
      return receipt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Balance initialization failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [initializeBalanceAsync, refetchInitialized]);

  /**
   * Withdraw tokens (requires proof that amount matches encrypted balance)
   */
  const withdraw = useCallback(async (
    amount: bigint,
    proof: string = '0x' // Simplified proof for demo
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const tx = await withdrawAsync([
        amount.toString(),
        proof
      ]);

      const receipt = await tx.wait();
      
      // Refresh balance
      await refetchBalance();
      
      return receipt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Withdrawal failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [withdrawAsync, refetchBalance]);

  /**
   * Transfer encrypted tokens to another user
   */
  const encryptedTransfer = useCallback(async (
    to: string,
    encryptedAmount: string,
    proof: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const tx = await encryptedTransferAsync([
        to,
        encryptedAmount,
        proof
      ]);

      const receipt = await tx.wait();
      
      // Refresh balance
      await refetchBalance();
      
      return receipt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transfer failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [encryptedTransferAsync, refetchBalance]);

  /**
   * Decrypt balance (placeholder - would require FHE decryption)
   */
  const decryptBalance = useCallback(async (
    encryptedBalance: string,
    userPrivateKey?: string
  ): Promise<bigint> => {
    // In a real implementation, this would use FHE decryption
    // For demo purposes, we'll return a placeholder
    console.warn('Balance decryption not implemented - using placeholder');
    return BigInt(0);
  }, []);

  /**
   * Format encrypted balance for display
   */
  const formatEncryptedBalance = useCallback((encrypted: string): string => {
    return encrypted && encrypted !== '0' ? '[Encrypted Balance]' : '0';
  }, []);

  /**
   * Get token information
   */
  const tokenInfo: TokenInfo = {
    name: name || 'Confidential WETH',
    symbol: symbol || 'cWETH',
    decimals: decimals || 18
  };

  /**
   * Get current balance info
   */
  const balance: ConfidentialBalance = {
    encrypted: encryptedBalance || '0',
    isInitialized: isInitialized || false
  };

  return {
    // Contract state
    contract,
    
    // Token info
    tokenInfo,
    
    // Balance info
    balance,
    isBalanceLoading,
    
    // Actions
    initializeBalance,
    withdraw,
    encryptedTransfer,
    decryptBalance,
    
    // Loading states
    isLoading,
    error,
    
    // Utilities
    formatEncryptedBalance,
    refetchBalance,
    refetchInitialized,
    
    // Contract availability
    isReady: !!contract && !!address
  };
}