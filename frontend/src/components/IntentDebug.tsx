"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWalletStore } from '@/lib/store';
import { useIntentCollector } from '@/hooks/useIntentCollector';
import { initializeFHE, isFHEAvailable, encryptDCAIntent } from '@/utils/fheEncryption';
import { SEPOLIA_CONTRACTS } from '@/config/contracts';
import { Loader2, Bug } from 'lucide-react';

export function IntentDebug() {
  const { isConnected, address, provider, signer } = useWalletStore();
  const { contract, submitIntent, isLoading } = useIntentCollector();
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const log = (message: string) => {
    console.log(`[Intent Debug] ${message}`);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearLog = () => {
    setDebugLog([]);
  };

  const testFullFlow = async () => {
    setTesting(true);
    clearLog();

    try {
      // Step 1: Check wallet connection
      log(`Step 1: Checking wallet connection...`);
      if (!isConnected || !address) {
        log(`❌ Wallet not connected`);
        return;
      }
      log(`✅ Wallet connected: ${address.substring(0, 10)}...`);

      // Step 2: Check provider and signer
      log(`Step 2: Checking provider and signer...`);
      if (!provider) {
        log(`❌ No provider available`);
        return;
      }
      log(`✅ Provider available`);

      if (!signer) {
        log(`❌ No signer available`);
        return;
      }
      log(`✅ Signer available`);

      // Step 3: Check contract
      log(`Step 3: Checking contract instance...`);
      if (!contract) {
        log(`❌ Contract not available`);
        return;
      }
      log(`✅ Contract instance created: ${SEPOLIA_CONTRACTS.INTENT_COLLECTOR}`);

      // Step 4: Test basic contract read
      log(`Step 4: Testing basic contract read...`);
      try {
        const batchStats = await contract.getBatchStats();
        log(`✅ Contract read successful: currentBatch=${batchStats[0]}, pending=${batchStats[1]}`);
      } catch (err) {
        log(`❌ Contract read failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return;
      }

      // Step 5: Test FHE initialization
      log(`Step 5: Testing FHE initialization...`);
      try {
        const fheInstance = await initializeFHE();
        if (!fheInstance) {
          log(`❌ FHE initialization returned null`);
          return;
        }
        log(`✅ FHE initialization successful`);
      } catch (err) {
        log(`❌ FHE initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return;
      }

      // Step 6: Test FHE availability
      log(`Step 6: Checking FHE availability...`);
      if (!isFHEAvailable()) {
        log(`❌ FHE not available after initialization`);
        return;
      }
      log(`✅ FHE is available`);

      // Step 7: Test parameter encryption
      log(`Step 7: Testing parameter encryption...`);
      const testParams = {
        budget: BigInt(1000000000), // 1000 USDC (6 decimals)
        tradesCount: 10,
        amountPerTrade: BigInt(100000000), // 100 USDC
        frequency: 86400, // 1 day
        minPrice: BigInt(150000000000), // $1500 (8 decimals)
        maxPrice: BigInt(250000000000), // $2500 (8 decimals)
      };

      try {
        const encryptedParams = await encryptDCAIntent(testParams, SEPOLIA_CONTRACTS.INTENT_COLLECTOR, address);
        log(`✅ Parameter encryption successful`);
        log(`  - Budget handle: ${encryptedParams.budget.encryptedData.substring(0, 20)}...`);
        log(`  - Budget proof: ${encryptedParams.budget.proof.substring(0, 20)}...`);
      } catch (err) {
        log(`❌ Parameter encryption failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return;
      }

      // Step 8: Test contract write preparation
      log(`Step 8: Testing contract method availability...`);
      try {
        if (typeof contract.submitIntent !== 'function') {
          log(`❌ submitIntent method not found in contract`);
          return;
        }
        log(`✅ submitIntent method available`);
      } catch (err) {
        log(`❌ Contract method check failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return;
      }

      log(`🎉 All checks passed! Ready for intent submission.`);

    } catch (error) {
      log(`❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const testActualSubmit = async () => {
    setTesting(true);
    log(`--- Testing actual intent submission ---`);

    try {
      const testParams = {
        budget: BigInt(1000000000), // 1000 USDC
        tradesCount: 10,
        amountPerTrade: BigInt(100000000), // 100 USDC
        frequency: 86400, // 1 day
        minPrice: BigInt(150000000000), // $1500
        maxPrice: BigInt(250000000000), // $2500
      };

      log(`Submitting test intent...`);
      const result = await submitIntent(testParams, SEPOLIA_CONTRACTS.INTENT_COLLECTOR, address!);
      log(`✅ Intent submitted successfully! Intent ID: ${result.intentId}`);
      log(`Transaction hash: ${result.receipt.transactionHash}`);

    } catch (error) {
      log(`❌ Intent submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error) {
        log(`Error stack: ${error.stack}`);
      }
    } finally {
      setTesting(false);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Intent Submission Debug
          </CardTitle>
          <CardDescription>
            Debug tool for troubleshooting intent submission issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please connect your wallet to use this debug tool.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          Intent Submission Debug
        </CardTitle>
        <CardDescription>
          Debug tool for troubleshooting intent submission issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex gap-2">
          <Button 
            onClick={testFullFlow}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Run Full Test'
            )}
          </Button>
          
          <Button 
            onClick={testActualSubmit}
            disabled={testing || isLoading}
            variant="outline"
          >
            {testing || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Test Real Submit'
            )}
          </Button>

          <Button 
            onClick={clearLog}
            variant="ghost"
            size="sm"
          >
            Clear Log
          </Button>
        </div>

        {/* Debug Log */}
        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
          {debugLog.length === 0 ? (
            <div className="text-gray-500">No debug output yet. Click "Run Full Test" to start.</div>
          ) : (
            debugLog.map((line, index) => (
              <div key={index}>{line}</div>
            ))
          )}
        </div>

        {/* System Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Wallet:</strong>
            <div>Connected: {isConnected ? '✅' : '❌'}</div>
            <div>Address: {address?.substring(0, 20)}...</div>
            <div>Provider: {provider ? '✅' : '❌'}</div>
            <div>Signer: {signer ? '✅' : '❌'}</div>
          </div>
          <div>
            <strong>Contract:</strong>
            <div>Instance: {contract ? '✅' : '❌'}</div>
            <div>Address: {SEPOLIA_CONTRACTS.INTENT_COLLECTOR.substring(0, 20)}...</div>
            <div>FHE Available: {isFHEAvailable() ? '✅' : '❌'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}