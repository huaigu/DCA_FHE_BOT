"use client";

import React, { useState } from 'react';
import { initializeFHE, isFHEAvailable, encryptAmount } from '@/utils/fheEncryption';

export default function FHETest() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const handleInitialize = async () => {
    setIsInitializing(true);
    setTestResult('');
    
    try {
      console.log('Starting FHE initialization...');
      const instance = await initializeFHE();
      
      if (instance) {
        setInitialized(true);
        setTestResult('✅ FHE initialized successfully!');
        console.log('FHE instance:', instance);
      } else {
        setTestResult('❌ FHE initialization returned null');
      }
    } catch (error) {
      setTestResult(`❌ FHE initialization failed: ${error}`);
      console.error('FHE initialization error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleTestEncryption = async () => {
    if (!isFHEAvailable()) {
      setTestResult('❌ FHE not available for testing');
      return;
    }

    setTestResult('Testing encryption...');
    
    try {
      // Mock data for testing
      const testAmount = BigInt(1000000); // 1 USDC (6 decimals)
      const contractAddress = '0x6473d5BC0D335f2e1E2fe0799878438721b0B8Ce';
      const userAddress = '0x170A6bBee5a0Baa90012D9C5cA541f27aFb43b9A';
      
      const encrypted = await encryptAmount(testAmount, contractAddress, userAddress);
      
      setTestResult(`✅ Encryption test passed!
Encrypted data: ${encrypted.encryptedData.substring(0, 20)}...
Proof: ${encrypted.proof.substring(0, 20)}...`);
    } catch (error) {
      setTestResult(`❌ Encryption test failed: ${error}`);
      console.error('Encryption test error:', error);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">FHE 加密测试</h2>
      
      <div className="space-y-4">
        <div>
          <button
            onClick={handleInitialize}
            disabled={isInitializing || initialized}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded"
          >
            {isInitializing ? '初始化中...' : initialized ? '✅ 已初始化' : '初始化 FHE'}
          </button>
        </div>

        {initialized && (
          <div>
            <button
              onClick={handleTestEncryption}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
            >
              测试加密功能
            </button>
          </div>
        )}

        {testResult && (
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded">
            <h3 className="font-semibold mb-2">测试结果：</h3>
            <pre className="whitespace-pre-wrap text-sm">{testResult}</pre>
          </div>
        )}
      </div>
    </div>
  );
}