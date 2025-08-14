import { ethers } from 'ethers';
import { useMemo } from 'react';
import { useWalletStore } from '@/lib/store';

/**
 * Base hook for creating contract instances
 */
export function useContract<T = ethers.Contract>(
  address: string,
  abi: ethers.InterfaceAbi,
  withSigner = false
): T | null {
  const { provider, signer } = useWalletStore();

  return useMemo(() => {
    if (!address || !provider) return null;

    try {
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
  }, [address, abi, provider, signer, withSigner]);
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
  const { data, error, isLoading, refetch } = useMemo(() => {
    if (!contract || !enabled) {
      return {
        data: null,
        error: null,
        isLoading: false,
        refetch: async () => null
      };
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async (): Promise<{
      data: T | null;
      error: Error | null;
      isLoading: boolean;
    }> => {
      try {
        const result = await contract[methodName](...args);
        if (isMounted) {
          return { data: result, error: null, isLoading: false };
        }
      } catch (err) {
        if (isMounted) {
          return { 
            data: null, 
            error: err as Error, 
            isLoading: false 
          };
        }
      }
      return { data: null, error: null, isLoading: false };
    };

    // Cleanup function
    const cleanup = () => {
      isMounted = false;
      controller.abort();
    };

    // Initial fetch
    const initialFetch = fetchData();

    return {
      data: null as T | null,
      error: null as Error | null,
      isLoading: true,
      refetch: fetchData,
      cleanup
    };
  }, [contract, methodName, JSON.stringify(args), enabled]);

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