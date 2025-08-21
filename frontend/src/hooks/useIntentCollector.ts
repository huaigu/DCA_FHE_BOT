import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useContract, useContractRead, useContractWrite } from "./useContract";
import { useWalletStore } from "@/lib/store";
import { SEPOLIA_CONTRACTS } from "@/config/contracts";
import { encryptDCAIntent } from "@/utils/fheEncryption";
import IntentCollectorABI from "@/config/abis/IntentCollector.json";

export interface DCAIntent {
  budget: bigint;
  tradesCount: number;
  amountPerTrade: bigint;
  frequency: number;
  minPrice: bigint;
  maxPrice: bigint;
  user: string;
  submittedAt: bigint;
  batchId: bigint;
  isActive: boolean;
  isProcessed: boolean;
}

export interface DCAIntentParams {
  budget: bigint;
  tradesCount: number;
  amountPerTrade: bigint;
  frequency: number;
  minPrice?: bigint;
  maxPrice?: bigint;
}

export interface BatchStatus {
  isReady: boolean;
  batchId: bigint;
  intentIds: bigint[];
}

export interface BatchStats {
  currentBatch: bigint;
  pendingCount: bigint;
  timeRemaining: bigint;
}

export function useIntentCollector() {
  const { address } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contract instance
  const contract = useContract(
    SEPOLIA_CONTRACTS.INTENT_COLLECTOR,
    IntentCollectorABI,
    true, // with signer for write operations
  );
  // Get user's intents
  const {
    data: userIntentIds,
    isLoading: isUserIntentsLoading,
    refetch: refetchUserIntents,
  } = useContractRead<bigint[]>(contract, "getUserIntents", address ? [address] : [], !!address);

  // Get batch status
  const {
    data: batchStatus,
    isLoading: isBatchStatusLoading,
    refetch: refetchBatchStatus,
  } = useContractRead<[boolean, bigint]>(contract, "checkBatchReady", [], true);

  // Get ready batch details (includes intent IDs)
  const {
    data: readyBatchData,
    isLoading: isReadyBatchLoading,
    refetch: refetchReadyBatch,
  } = useContractRead<[bigint, bigint[]]>(
    contract,
    "getReadyBatch",
    [],
    true, // re-enabled - function has no parameters as confirmed in contract
  );

  // Get batch statistics
  const {
    data: batchStatsData,
    isLoading: isBatchStatsLoading,
    refetch: refetchBatchStats,
  } = useContractRead<[bigint, bigint, bigint]>(contract, "getBatchStats", [], true);

  // Contract write function
  const { writeAsync: submitIntentAsync } = useContractWrite(contract, "submitIntent");

  /**
   * Submit a new DCA intent
   */
  const submitIntent = useCallback(
    async (params: DCAIntentParams, contractAddress: string, userAddress: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // Encrypt all DCA parameters
        const encryptedParams = await encryptDCAIntent(params, contractAddress, userAddress);

        // Submit intent with parameters as a struct
        const submitIntentParams = {
          budgetExt: encryptedParams.budget.encryptedData,
          budgetProof: encryptedParams.budget.proof,
          tradesCountExt: encryptedParams.tradesCount.encryptedData,
          tradesCountProof: encryptedParams.tradesCount.proof,
          amountPerTradeExt: encryptedParams.amountPerTrade.encryptedData,
          amountPerTradeProof: encryptedParams.amountPerTrade.proof,
          frequencyExt: encryptedParams.frequency.encryptedData,
          frequencyProof: encryptedParams.frequency.proof,
          minPriceExt: encryptedParams.minPrice.encryptedData,
          minPriceProof: encryptedParams.minPrice.proof,
          maxPriceExt: encryptedParams.maxPrice.encryptedData,
          maxPriceProof: encryptedParams.maxPrice.proof,
        };
        
        const tx = await submitIntentAsync([submitIntentParams]);

        // Wait for transaction confirmation
        const receipt = await tx.wait();

        // Extract intent ID from events
        const intentSubmittedEvent = receipt.logs.find((log: any) => log.fragment?.name === "IntentSubmitted");

        const intentId = intentSubmittedEvent ? intentSubmittedEvent.args[0] : null;

        // Refresh data
        await Promise.all([refetchUserIntents(), refetchBatchStatus(), refetchReadyBatch(), refetchBatchStats()]);

        return {
          receipt,
          intentId,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Intent submission failed";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [submitIntentAsync, refetchUserIntents, refetchBatchStatus, refetchReadyBatch, refetchBatchStats],
  );

  /**
   * Get intent details by ID
   */
  const getIntent = useCallback(
    async (intentId: bigint): Promise<DCAIntent | null> => {
      if (!contract) return null;

      try {
        const intentData = await contract.getIntent(intentId);
        return {
          budget: intentData[0],
          tradesCount: Number(intentData[1]),
          amountPerTrade: intentData[2],
          frequency: Number(intentData[3]),
          minPrice: intentData[4],
          maxPrice: intentData[5],
          user: intentData[6],
          submittedAt: intentData[7],
          batchId: intentData[8],
          isActive: intentData[9],
          isProcessed: intentData[10],
        };
      } catch (err) {
        console.error("Failed to fetch intent:", err);
        return null;
      }
    },
    [contract],
  );

  /**
   * Get formatted batch status
   */
  const getCurrentBatchStatus = (): BatchStatus => {
    if (!batchStatus) {
      return {
        isReady: false,
        batchId: BigInt(0),
        intentIds: [],
      };
    }

    // Get intent IDs from readyBatchData if batch is ready and data is available
    // If readyBatchData is unavailable due to contract issues, return empty array
    const intentIds = batchStatus[0] && readyBatchData ? readyBatchData[1] : [];

    return {
      isReady: batchStatus[0],
      batchId: batchStatus[1],
      intentIds: intentIds,
    };
  };

  /**
   * Get formatted batch statistics
   */
  const getBatchStats = (): BatchStats => {
    if (!batchStatsData) {
      return {
        currentBatch: BigInt(0),
        pendingCount: BigInt(0),
        timeRemaining: BigInt(0),
      };
    }

    return {
      currentBatch: batchStatsData[0],
      pendingCount: batchStatsData[1],
      timeRemaining: batchStatsData[2],
    };
  };

  /**
   * Calculate DCA strategy summary
   */
  const calculateStrategy = useCallback((params: DCAIntentParams) => {
    const { budget, tradesCount, amountPerTrade } = params;

    // Auto-calculate amount per trade if not provided
    const finalAmountPerTrade = amountPerTrade || budget / BigInt(tradesCount);

    // Calculate total duration
    const totalDuration = tradesCount * params.frequency;

    return {
      amountPerTrade: finalAmountPerTrade,
      totalDuration,
      totalCost: finalAmountPerTrade * BigInt(tradesCount),
    };
  }, []);

  return {
    // Contract state
    contract,

    // Data
    userIntentIds: userIntentIds || [],
    currentBatchStatus: getCurrentBatchStatus(),
    batchStats: getBatchStats(),

    // Loading states
    isLoading,
    isUserIntentsLoading,
    isBatchStatusLoading,
    isReadyBatchLoading,
    isBatchStatsLoading,
    error,

    // Actions
    submitIntent,
    getIntent,
    calculateStrategy,

    // Refresh functions
    refetchUserIntents,
    refetchBatchStatus,
    refetchReadyBatch,
    refetchBatchStats,

    // Contract availability
    isReady: !!contract && !!address,
  };
}
