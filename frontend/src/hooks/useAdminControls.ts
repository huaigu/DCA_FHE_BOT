import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWalletStore } from '../lib/store';
import { SEPOLIA_CONTRACTS } from '../config/contracts';
import batchProcessorAbi from '../config/abis/BatchProcessor.json';
import intentCollectorAbi from '../config/abis/IntentCollector.json';

interface BatchStats {
  currentBatch: string;
  pendingCount: string;
  timeRemaining: string;
}

interface BatchReadyInfo {
  isReady: boolean;
  batchId: string;
}

interface TriggerState {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: Error;
  txHash?: string;
}

export function useAdminControls() {
  const { isConnected, address, provider } = useWalletStore();
  const [isPolling, setIsPolling] = useState(false);
  const [owner, setOwner] = useState<string | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [batchReadyInfo, setBatchReadyInfo] = useState<BatchReadyInfo | null>(null);
  const [pendingIntentsCount, setPendingIntentsCount] = useState<string | null>(null);
  const [triggerState, setTriggerState] = useState<TriggerState>({
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  // Check if current user is contract owner
  const isOwner = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase());

  // Get contract instances
  const getBatchProcessor = useCallback(() => {
    if (!provider) return null;
    return new ethers.Contract(
      SEPOLIA_CONTRACTS.BATCH_PROCESSOR,
      batchProcessorAbi.abi,
      provider
    );
  }, [provider]);

  const getIntentCollector = useCallback(() => {
    if (!provider) return null;
    return new ethers.Contract(
      SEPOLIA_CONTRACTS.INTENT_COLLECTOR,
      intentCollectorAbi.abi,
      provider
    );
  }, [provider]);

  // Fetch owner address
  const fetchOwner = useCallback(async () => {
    if (!isConnected || !provider) return;
    
    try {
      const batchProcessor = getBatchProcessor();
      if (!batchProcessor) return;
      
      const ownerAddress = await batchProcessor.owner();
      setOwner(ownerAddress);
    } catch (error) {
      console.error('Error fetching owner:', error);
    }
  }, [isConnected, provider, getBatchProcessor]);

  // Fetch batch statistics
  const fetchBatchStats = useCallback(async () => {
    if (!isConnected || !provider || !isOwner) return;
    
    try {
      const intentCollector = getIntentCollector();
      if (!intentCollector) return;
      
      const stats = await intentCollector.getBatchStats();
      setBatchStats({
        currentBatch: stats[0].toString(),
        pendingCount: stats[1].toString(),
        timeRemaining: stats[2].toString(),
      });
    } catch (error) {
      console.error('Error fetching batch stats:', error);
    }
  }, [isConnected, provider, isOwner, getIntentCollector]);

  // Check if batch is ready
  const fetchBatchReady = useCallback(async () => {
    if (!isConnected || !provider) return;
    
    try {
      const intentCollector = getIntentCollector();
      if (!intentCollector) return;
      
      const readyInfo = await intentCollector.checkBatchReady();
      setBatchReadyInfo({
        isReady: readyInfo[0],
        batchId: readyInfo[1].toString(),
      });
    } catch (error) {
      console.error('Error checking batch ready:', error);
    }
  }, [isConnected, provider, getIntentCollector]);

  // Fetch pending intents count
  const fetchPendingCount = useCallback(async () => {
    if (!isConnected || !provider || !isOwner) return;
    
    try {
      const intentCollector = getIntentCollector();
      if (!intentCollector) return;
      
      const count = await intentCollector.getPendingIntentsCount();
      setPendingIntentsCount(count.toString());
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  }, [isConnected, provider, isOwner, getIntentCollector]);

  // Manual trigger function
  const handleTriggerBatch = useCallback(async () => {
    if (!batchReadyInfo?.isReady || !provider || !address) {
      console.error('Batch not ready or wallet not connected');
      return;
    }

    setTriggerState({
      isLoading: true,
      isSuccess: false,
      isError: false,
    });

    try {
      const signer = provider.getSigner();
      const batchProcessor = new ethers.Contract(
        SEPOLIA_CONTRACTS.BATCH_PROCESSOR,
        batchProcessorAbi.abi,
        await signer
      );

      const tx = await batchProcessor.manualTriggerBatch(batchReadyInfo.batchId);
      const receipt = await tx.wait();

      setTriggerState({
        isLoading: false,
        isSuccess: true,
        isError: false,
        txHash: tx.hash,
      });

      // Refresh data after successful trigger
      setTimeout(() => {
        refreshData();
      }, 2000);

    } catch (error) {
      console.error('Error triggering batch:', error);
      setTriggerState({
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: error as Error,
      });
    }
  }, [batchReadyInfo, provider, address]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    // Always check batch ready status (no owner restriction)
    await fetchBatchReady();
    
    // Owner-only data
    if (isOwner) {
      await Promise.all([
        fetchBatchStats(),
        fetchPendingCount(),
      ]);
    }
  }, [isOwner, fetchBatchStats, fetchBatchReady, fetchPendingCount]);

  // Start/stop polling
  const startPolling = useCallback(() => {
    setIsPolling(true);
    refreshData(); // Immediate refresh
  }, [refreshData]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Fetch owner on wallet connection
  useEffect(() => {
    if (isConnected && provider) {
      fetchOwner();
      // Always fetch batch ready status when wallet connects
      fetchBatchReady();
    } else {
      setOwner(null);
      setBatchStats(null);
      setBatchReadyInfo(null);
      setPendingIntentsCount(null);
    }
  }, [isConnected, provider, fetchOwner, fetchBatchReady]);

  // Auto-refresh when owner status is determined
  useEffect(() => {
    if (isOwner) {
      refreshData();
    }
  }, [isOwner, refreshData]);

  // Auto-refresh polling
  useEffect(() => {
    if (!isPolling || !isConnected) return;

    const interval = setInterval(() => {
      refreshData();
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [isPolling, isConnected, refreshData]);

  return {
    // Owner status
    isOwner,
    owner,
    
    // Batch data
    batchStats,
    batchReadyInfo,
    pendingIntentsCount,
    
    // Actions
    triggerBatch: handleTriggerBatch,
    refreshData,
    startPolling,
    stopPolling,
    
    // Transaction states
    isTriggerLoading: triggerState.isLoading,
    isTriggerSuccess: triggerState.isSuccess,
    isTriggerError: triggerState.isError,
    triggerError: triggerState.error,
    triggerTxHash: triggerState.txHash,
    
    // Polling state
    isPolling,
  };
}

export type AdminControls = ReturnType<typeof useAdminControls>;