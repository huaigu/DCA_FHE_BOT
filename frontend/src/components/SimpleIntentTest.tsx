"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWalletStore } from '@/lib/store';
import { useIntentCollector } from '@/hooks/useIntentCollector';
import { SEPOLIA_CONTRACTS } from '@/config/contracts';
import { Loader2, Play, CheckCircle, XCircle } from 'lucide-react';

export function SimpleIntentTest() {
  const { isConnected, address } = useWalletStore();
  const { submitIntent } = useIntentCollector();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleTestSubmit = async () => {
    if (!isConnected || !address) {
      setResult({
        success: false,
        message: 'Wallet not connected'
      });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      console.log('🧪 Starting simple intent submission test...');

      // Simple test parameters
      const testParams = {
        budget: BigInt(1000 * 1e6), // 1000 USDC (6 decimals)
        tradesCount: 10,
        amountPerTrade: BigInt(100 * 1e6), // 100 USDC per trade  
        frequency: 24 * 3600, // 1 day in seconds
        minPrice: BigInt(1500 * 1e8), // $1500 (8 decimals for price)
        maxPrice: BigInt(2500 * 1e8), // $2500 (8 decimals for price)
      };

      console.log('📊 Test parameters:', {
        budget: testParams.budget.toString(),
        tradesCount: testParams.tradesCount,
        amountPerTrade: testParams.amountPerTrade.toString(),
        frequency: testParams.frequency,
        minPrice: testParams.minPrice.toString(),
        maxPrice: testParams.maxPrice.toString(),
      });

      console.log('📞 Calling submitIntent...');
      const result = await submitIntent(
        testParams, 
        SEPOLIA_CONTRACTS.INTENT_COLLECTOR, 
        address
      );

      console.log('✅ Intent submitted successfully:', result);

      setResult({
        success: true,
        message: 'Intent submitted successfully!',
        details: {
          intentId: result.intentId?.toString(),
          transactionHash: result.receipt.transactionHash,
          blockNumber: result.receipt.blockNumber,
        }
      });

    } catch (error) {
      console.error('❌ Intent submission failed:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Error stack:', error.stack);
      }

      setResult({
        success: false,
        message: `Submission failed: ${errorMessage}`,
        details: error
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Simple Intent Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Connect your wallet to test intent submission.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Simple Intent Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Test Parameters:</h4>
          <div className="text-sm space-y-1">
            <div>💰 Budget: 1,000 USDC</div>
            <div>🔢 Trades: 10 trades</div>
            <div>💵 Amount per trade: 100 USDC</div>
            <div>⏰ Frequency: 1 day</div>
            <div>📈 Price range: $1,500 - $2,500</div>
          </div>
        </div>

        <Button 
          onClick={handleTestSubmit}
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting Test Intent...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Submit Test Intent
            </>
          )}
        </Button>

        {result && (
          <div className={`p-4 rounded-lg border ${
            result.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {result.message}
                </p>
                
                {result.details && result.success && (
                  <div className="mt-2 text-sm text-green-700">
                    <div>Intent ID: {result.details.intentId}</div>
                    <div>Transaction: {result.details.transactionHash}</div>
                    <div>Block: {result.details.blockNumber}</div>
                  </div>
                )}

                {result.details && !result.success && (
                  <details className="mt-2">
                    <summary className="text-sm text-red-700 cursor-pointer">Show Error Details</summary>
                    <pre className="mt-1 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>This test will attempt to submit a DCA intent with predefined parameters.</p>
          <p>Check the browser console for detailed logs during the process.</p>
        </div>
      </CardContent>
    </Card>
  );
}