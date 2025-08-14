import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useContract, useContractRead, useContractWrite } from './useContract';
import { useWalletStore } from '@/lib/store';
import { SEPOLIA_CONTRACTS } from '@/config/contracts';
import ERC20ABI from '@/config/abis/ERC20.json';

export function useUSDC() {
  const { address } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // USDC contract instance
  const contract = useContract(
    SEPOLIA_CONTRACTS.USDC,
    ERC20ABI,
    true // with signer for write operations
  );

  // Get user's USDC balance
  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance
  } = useContractRead<bigint>(
    contract,
    'balanceOf',
    address ? [address] : [],
    !!address
  );

  // Get USDC allowance for FundPool
  const {
    data: allowance,
    isLoading: isAllowanceLoading,
    refetch: refetchAllowance
  } = useContractRead<bigint>(
    contract,
    'allowance',
    address ? [address, SEPOLIA_CONTRACTS.FUND_POOL] : [],
    !!address && !!SEPOLIA_CONTRACTS.FUND_POOL
  );

  // Get token info
  const { data: name } = useContractRead<string>(contract, 'name', [], true);
  const { data: symbol } = useContractRead<string>(contract, 'symbol', [], true);
  const { data: decimals } = useContractRead<number>(contract, 'decimals', [], true);

  // Contract write functions
  const { writeAsync: approveAsync } = useContractWrite(contract, 'approve');
  const { writeAsync: transferAsync } = useContractWrite(contract, 'transfer');

  /**
   * Approve USDC spending for FundPool
   */
  const approve = useCallback(async (amount: bigint) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!SEPOLIA_CONTRACTS.FUND_POOL) {
        throw new Error('FundPool contract address not configured');
      }

      const tx = await approveAsync([
        SEPOLIA_CONTRACTS.FUND_POOL,
        amount.toString()
      ]);

      const receipt = await tx.wait();
      
      // Refresh allowance
      await refetchAllowance();
      
      return receipt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Approval failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [approveAsync, refetchAllowance]);

  /**
   * Approve maximum USDC spending for FundPool
   */
  const approveMax = useCallback(async () => {
    const maxAmount = ethers.MaxUint256;
    return approve(maxAmount);
  }, [approve]);

  /**
   * Transfer USDC tokens
   */
  const transfer = useCallback(async (to: string, amount: bigint) => {
    setIsLoading(true);
    setError(null);

    try {
      const tx = await transferAsync([to, amount.toString()]);
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
  }, [transferAsync, refetchBalance]);

  /**
   * Check if user has sufficient balance
   */
  const hasSufficientBalance = useCallback((amount: bigint): boolean => {
    return balance ? balance >= amount : false;
  }, [balance]);

  /**
   * Check if user has sufficient allowance
   */
  const hasSufficientAllowance = useCallback((amount: bigint): boolean => {
    return allowance ? allowance >= amount : false;
  }, [allowance]);

  /**
   * Check if approval is needed
   */
  const needsApproval = useCallback((amount: bigint): boolean => {
    return !hasSufficientAllowance(amount);
  }, [hasSufficientAllowance]);

  /**
   * Format USDC amount (6 decimals)
   */
  const formatAmount = useCallback((amount: bigint, showSymbol = true): string => {
    const decimalsCount = decimals || 6;
    const divisor = BigInt(10 ** decimalsCount);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    
    const formattedFraction = fraction.toString().padStart(decimalsCount, '0').replace(/0+$/, '');
    const result = formattedFraction ? `${whole}.${formattedFraction}` : whole.toString();
    
    return showSymbol ? `${result} ${symbol || 'USDC'}` : result;
  }, [decimals, symbol]);

  /**
   * Parse USDC amount from string
   */
  const parseAmount = useCallback((value: string): bigint => {
    const decimalsCount = decimals || 6;
    
    if (!value || value === '') return BigInt(0);
    
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    
    // Split on decimal point
    const [whole, fraction = ''] = cleanValue.split('.');
    
    // Pad or truncate fraction to correct decimals
    const paddedFraction = fraction.slice(0, decimalsCount).padEnd(decimalsCount, '0');
    
    return BigInt((whole || '0') + paddedFraction);
  }, [decimals]);

  return {
    // Contract state
    contract,
    
    // Token info
    name: name || 'USD Coin',
    symbol: symbol || 'USDC',
    decimals: decimals || 6,
    
    // Balances
    balance: balance || BigInt(0),
    allowance: allowance || BigInt(0),
    isBalanceLoading,
    isAllowanceLoading,
    
    // Actions
    approve,
    approveMax,
    transfer,
    
    // Utilities
    hasSufficientBalance,
    hasSufficientAllowance,
    needsApproval,
    formatAmount,
    parseAmount,
    
    // Loading states
    isLoading,
    error,
    
    // Refresh functions
    refetchBalance,
    refetchAllowance,
    
    // Contract availability
    isReady: !!contract && !!address
  };
}