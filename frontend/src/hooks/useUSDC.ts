import { useState, useCallback, useEffect } from 'react';
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

  // Get user's USDC balance with improved state management
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const refetchBalance = useCallback(async () => {
    if (!contract || !address) {
      return;
    }

    console.log('Attempting to fetch USDC balance:', {
      contractAddress: SEPOLIA_CONTRACTS.USDC,
      userAddress: address,
      chainId: 11155111
    });

    setIsBalanceLoading(true);
    try {
      // First, let's verify the contract exists by checking if it has code
      const provider = contract.runner?.provider;
      if (provider && 'getCode' in provider) {
        const code = await provider.getCode(SEPOLIA_CONTRACTS.USDC);
        console.log('Contract code length:', code.length, 'Code:', code);
        
        if (code === '0x') {
          throw new Error(`No contract found at address ${SEPOLIA_CONTRACTS.USDC}. This address may not be a valid contract or may be on a different network.`);
        }
      }

      // Now try to call balanceOf
      console.log('Calling balanceOf...');
      const result = await contract.balanceOf(address);
      console.log('Balance result:', result?.toString());
      
      setBalance(result);
      setError(null);
    } catch (error) {
      console.error('Error fetching USDC balance:', error);
      
      let errorMessage = 'Failed to fetch balance';
      if (error instanceof Error) {
        if (error.message.includes('could not decode result data')) {
          errorMessage = `Contract at ${SEPOLIA_CONTRACTS.USDC} returned invalid data. This may not be a valid ERC20 contract.`;
        } else if (error.message.includes('network')) {
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsBalanceLoading(false);
    }
  }, [contract, address]);

  // Auto-fetch balance when contract and address are available
  useEffect(() => {
    if (contract && address) {
      void refetchBalance();
    }
  }, [contract, address, refetchBalance]);

  // Get USDC allowance for FundPool with error handling
  const {
    data: allowance,
    isLoading: isAllowanceLoading,
    refetch: refetchAllowance
  } = useContractRead<bigint>(
    contract,
    'allowance',
    address && SEPOLIA_CONTRACTS.FUND_POOL ? [address, SEPOLIA_CONTRACTS.FUND_POOL] : [],
    false // temporarily disabled to fix call error
  );

  // Token info state with fallback values
  const [tokenInfo, setTokenInfo] = useState<{
    name: string;
    symbol: string;
    decimals: number;
  }>({
    name: 'USD Coin',
    symbol: 'USDC', 
    decimals: 6
  });

  // Try to fetch token info safely
  useEffect(() => {
    if (!contract) return;
    
    const fetchTokenInfo = async () => {
      try {
        // Try to get token info, but don't fail if the contract doesn't support these functions
        const [nameResult, symbolResult, decimalsResult] = await Promise.allSettled([
          contract.name().catch(() => 'USD Coin'),
          contract.symbol().catch(() => 'USDC'),
          contract.decimals().catch(() => 6)
        ]);

        setTokenInfo({
          name: nameResult.status === 'fulfilled' ? nameResult.value : 'USD Coin',
          symbol: symbolResult.status === 'fulfilled' ? symbolResult.value : 'USDC',
          decimals: decimalsResult.status === 'fulfilled' ? decimalsResult.value : 6
        });
      } catch (error) {
        console.log('Could not fetch token info, using defaults:', error);
        // Keep default values
      }
    };

    void fetchTokenInfo();
  }, [contract]);

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
    const decimalsCount = typeof tokenInfo.decimals === 'number' ? tokenInfo.decimals : 6; // ensure it's a number
    // Create divisor by multiplying BigInt(10) decimalsCount times
    let divisor = BigInt(1);
    for (let i = 0; i < decimalsCount; i++) {
      divisor = divisor * BigInt(10);
    }
    const whole = amount / divisor;
    const fraction = amount % divisor;
    
    const formattedFraction = fraction.toString().padStart(decimalsCount, '0').replace(/0+$/, '');
    const result = formattedFraction ? `${whole}.${formattedFraction}` : whole.toString();
    
    return showSymbol ? `${result} ${tokenInfo.symbol || 'USDC'}` : result;
  }, [tokenInfo.decimals, tokenInfo.symbol]);

  /**
   * Parse USDC amount from string
   */
  const parseAmount = useCallback((value: string): bigint => {
    const decimalsCount = tokenInfo.decimals;
    
    if (!value || value === '') return BigInt(0);
    
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    
    // Split on decimal point
    const [whole, fraction = ''] = cleanValue.split('.');
    
    // Pad or truncate fraction to correct decimals
    const paddedFraction = fraction.slice(0, decimalsCount).padEnd(decimalsCount, '0');
    
    return BigInt((whole || '0') + paddedFraction);
  }, [tokenInfo.decimals]);

  return {
    // Contract state
    contract,
    
    // Token info
    name: tokenInfo.name,
    symbol: tokenInfo.symbol,
    decimals: tokenInfo.decimals,
    
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