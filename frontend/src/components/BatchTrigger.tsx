'use client';

import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { AdminControls } from '../hooks/useAdminControls';

interface BatchTriggerProps {
  adminControls: AdminControls;
}

export function BatchTrigger({ adminControls }: BatchTriggerProps) {
  const {
    batchStats,
    batchReadyInfo,
    pendingIntentsCount,
    triggerBatch,
    isTriggerLoading,
    isTriggerSuccess,
    isTriggerError,
    triggerError,
    triggerTxHash,
    refreshData,
    startPolling,
    stopPolling,
    isPolling,
  } = adminControls;

  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Auto-refresh timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format time remaining
  const formatTimeRemaining = (seconds: string) => {
    const totalSeconds = parseInt(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Batch Status Card */}
      <Card className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold">Batch Status</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={isTriggerLoading}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={isPolling ? stopPolling : startPolling}
            >
              {isPolling ? 'Stop Auto-refresh' : 'Start Auto-refresh'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {batchStats?.currentBatch?.toString() || '0'}
            </div>
            <div className="text-sm text-gray-600">Current Batch ID</div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {(pendingIntentsCount || batchStats?.pendingCount)?.toString() || '0'}
            </div>
            <div className="text-sm text-gray-600">Pending Intents</div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {batchStats?.timeRemaining 
                ? formatTimeRemaining(batchStats.timeRemaining)
                : '0s'
              }
            </div>
            <div className="text-sm text-gray-600">Time Until Timeout</div>
          </div>
        </div>

        {/* Batch Ready Status */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${
            batchReadyInfo?.isReady ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          <span className="font-medium">
            {batchReadyInfo?.isReady ? 'Batch Ready for Processing' : 'Batch Not Ready'}
          </span>
          {batchReadyInfo?.isReady && (
            <span className="text-sm text-gray-600">
              (Batch ID: {batchReadyInfo.batchId.toString()})
            </span>
          )}
        </div>

        <div className="text-xs text-gray-500 mb-4">
          Last updated: {lastUpdate.toLocaleTimeString()}
          {isPolling && (
            <span className="ml-2 inline-flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
              Auto-refreshing
            </span>
          )}
        </div>
      </Card>

      {/* Manual Trigger Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Manual Batch Trigger</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Manually process the current batch when ready</li>
              <li>• Requires minimum batch size or timeout to be met</li>
              <li>• Only contract owner can trigger manual processing</li>
              <li>• Transaction will execute DCA swaps for all valid intents</li>
            </ul>
          </div>

          <Button
            onClick={triggerBatch}
            disabled={!batchReadyInfo?.isReady || isTriggerLoading}
            className="w-full"
            size="lg"
          >
            {isTriggerLoading 
              ? 'Processing Batch...' 
              : batchReadyInfo?.isReady 
                ? `Trigger Batch ${batchReadyInfo.batchId.toString()}`
                : 'Batch Not Ready'
            }
          </Button>

          {/* Transaction Status */}
          {isTriggerSuccess && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="font-medium">Batch triggered successfully!</span>
              </div>
              {triggerTxHash && (
                <div className="mt-2 text-sm text-green-700">
                  Transaction: 
                  <a 
                    href={`https://sepolia.etherscan.io/tx/${triggerTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 underline hover:no-underline"
                  >
                    {triggerTxHash.slice(0, 10)}...{triggerTxHash.slice(-8)}
                  </a>
                </div>
              )}
            </div>
          )}

          {isTriggerError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✕</span>
                </div>
                <span className="font-medium">Transaction failed</span>
              </div>
              {triggerError && (
                <div className="text-sm text-red-700">
                  {triggerError.message || 'Unknown error occurred'}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Additional Info Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">System Information</h2>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Contract Network:</span>
            <span className="font-mono">Sepolia Testnet</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Batch Timeout:</span>
            <span>5 minutes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Min Batch Size:</span>
            <span>5 intents (configurable)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Processing Mode:</span>
            <span>Manual + Chainlink Automation</span>
          </div>
        </div>
      </Card>
    </div>
  );
}