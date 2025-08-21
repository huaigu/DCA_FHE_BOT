import { ethers } from 'ethers';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWalletStore } from '@/lib/store';

// Type for Hardhat artifact
interface HardhatArtifact {
  abi: ethers.InterfaceAbi;
  [key: string]: any;
}

/**
 * Extract ABI from either raw ABI array or Hardhat artifact
 */
function extractABI(abiOrArtifact: ethers.InterfaceAbi | HardhatArtifact): ethers.InterfaceAbi {
  // If it has an 'abi' property, it's a Hardhat artifact
  if (typeof abiOrArtifact === 'object' && abiOrArtifact !== null && 'abi' in abiOrArtifact) {
    return (abiOrArtifact as HardhatArtifact).abi;
  }
  // Otherwise, it's already an ABI
  return abiOrArtifact as ethers.InterfaceAbi;
}

/**
 * Base hook for creating contract instances
 */
export function useContract<T = ethers.Contract>(
  address: string,
  abiOrArtifact: ethers.InterfaceAbi | HardhatArtifact,
  withSigner = false
): T | null {
  const { provider, signer } = useWalletStore();

  return useMemo(() => {
    if (!address || !provider) return null;

    try {
      const abi = extractABI(abiOrArtifact);
      const contract = new ethers.Contract(
        address,
        abi,
        withSigner && signer ? signer : provider
      );
      return contract as T;
    } catch (error) {
      console.error('Failed to create contract instance:', error);
      return null;
    }
  }, [address, abiOrArtifact, provider, signer, withSigner]);
}

/**
 * Hook for reading contract data
 */
export function useContractRead<T>(
  contract: ethers.Contract | null,
  methodName: string,
  args: any[] = [],
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async (): Promise<T | null> => {
    if (!contract || !enabled) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await contract[methodName](...args);
      setData(result);
      setIsLoading(false);
      return result;
    } catch (err) {
      const error = err as Error;
      console.error(`Contract read error (${methodName}):`, error);
      setError(error);
      setData(null);
      setIsLoading(false);
      return null;
    }
  }, [contract, methodName, JSON.stringify(args), enabled]);

  // Auto-fetch on mount and dependency changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    return await fetchData();
  }, [fetchData]);

  return { data, error, isLoading, refetch };
}

/**
 * Hook for writing to contracts
 */
export function useContractWrite(
  contract: ethers.Contract | null,
  methodName: string
) {
  const writeAsync = async (args: any[] = [], overrides: any = {}) => {
    if (!contract) {
      throw new Error('Contract not available');
    }

    const tx = await contract[methodName](...args, overrides);
    return tx;
  };

  const write = async (args: any[] = [], overrides: any = {}) => {
    const tx = await writeAsync(args, overrides);
    return await tx.wait();
  };

  return {
    write,
    writeAsync,
    isReady: !!contract
  };
}