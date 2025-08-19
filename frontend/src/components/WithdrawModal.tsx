'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Download, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/use-toast';
import { useFundPool } from '@/hooks/useFundPool';
import { useConfidentialToken } from '@/hooks/useConfidentialToken';
import { useUSDC } from '@/hooks/useUSDC';
import { useWalletStore } from '@/lib/store';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WithdrawTab = 'usdc' | 'weth';

export function WithdrawModal({ isOpen, onClose, onSuccess }: WithdrawModalProps) {
  const [activeTab, setActiveTab] = useState<WithdrawTab>('usdc');
  const [amount, setAmount] = useState('');
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const { toast } = useToast();
  const { address } = useWalletStore();

  // Hooks
  const {
    balance: fundPoolBalance,
    withdraw: withdrawFromFundPool,
    formatBalance,
    isLoading: isFundPoolLoading
  } = useFundPool();

  const {
    balance: tokenBalance,
    withdraw: withdrawFromToken,
    tokenInfo,
    formatEncryptedBalance,
    decryptBalance,
    isLoading: isTokenLoading
  } = useConfidentialToken();

  const { formatAmount } = useUSDC();

  const isLoading = isFundPoolLoading || isTokenLoading;

  // Parse input amount
  const parsedAmount = amount ? BigInt(Math.floor(parseFloat(amount) * 1e6)) : BigInt(0);
  const hasValidAmount = parsedAmount > 0;

  /**
   * Handle balance decryption
   */
  const handleDecryptBalance = useCallback(async () => {
    try {
      const encrypted = activeTab === 'usdc' ? 
        fundPoolBalance.encrypted : 
        tokenBalance.encrypted;
      
      if (!encrypted || encrypted === '0') {
        setDecryptedBalance('0');
        setShowDecrypted(true);
        return;
      }

      // In a real implementation, this would use FHE decryption
      // For demo purposes, we'll simulate decryption
      const simulatedDecrypted = Math.random() * 1000;
      setDecryptedBalance(simulatedDecrypted.toFixed(2));
      setShowDecrypted(true);

      toast({
        title: 'Balance Decrypted',
        description: 'Your encrypted balance has been decrypted locally.',
      });
    } catch (error) {
      console.error('Decryption failed:', error);
      toast({
        title: 'Decryption Failed',
        description: 'Failed to decrypt balance. Please try again.',
        variant: 'destructive',
      });
    }
  }, [activeTab, fundPoolBalance.encrypted, tokenBalance.encrypted, toast]);

  /**
   * Handle withdrawal
   */
  const handleWithdraw = useCallback(async () => {
    if (!hasValidAmount || !address) return;

    try {
      toast({
        title: 'Processing Withdrawal',
        description: `Withdrawing ${amount} ${activeTab.toUpperCase()}...`,
      });

      if (activeTab === 'usdc') {
        // Withdraw from FundPool
        await withdrawFromFundPool(parsedAmount);
      } else {
        // Withdraw from ConfidentialToken
        await withdrawFromToken(parsedAmount);
      }

      toast({
        title: 'Withdrawal Successful',
        description: `Successfully withdrew ${amount} ${activeTab.toUpperCase()}.`,
      });

      // Reset form and close
      setAmount('');
      setShowDecrypted(false);
      setDecryptedBalance(null);
      onSuccess?.();
      onClose();

    } catch (error) {
      console.error('Withdrawal failed:', error);
      toast({
        title: 'Withdrawal Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
        variant: 'destructive',
      });
    }
  }, [
    hasValidAmount,
    address,
    amount,
    activeTab,
    parsedAmount,
    withdrawFromFundPool,
    withdrawFromToken,
    toast,
    onSuccess,
    onClose
  ]);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    if (isLoading) return;
    setAmount('');
    setShowDecrypted(false);
    setDecryptedBalance(null);
    setActiveTab('usdc');
    onClose();
  }, [isLoading, onClose]);

  /**
   * Set maximum amount
   */
  const setMaxAmount = useCallback(() => {
    if (showDecrypted && decryptedBalance) {
      setAmount(decryptedBalance);
    }
  }, [showDecrypted, decryptedBalance]);

  if (!isOpen) return null;

  const currentBalance = activeTab === 'usdc' ? fundPoolBalance : tokenBalance;
  const isInitialized = currentBalance.isInitialized;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <Card className="p-6 bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Withdraw Tokens</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Tab Selection */}
            <div className="flex gap-2 mb-6">
              <Button
                variant={activeTab === 'usdc' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('usdc')}
                className="flex-1"
              >
                USDC
              </Button>
              <Button
                variant={activeTab === 'weth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('weth')}
                className="flex-1"
              >
                {tokenInfo.symbol}
              </Button>
            </div>

            {/* Balance Section */}
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">
                    {activeTab === 'usdc' ? 'FundPool Balance' : `${tokenInfo.symbol} Balance`}
                  </span>
                  {isInitialized && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDecryptBalance}
                      className="h-6 px-2 text-xs"
                    >
                      {showDecrypted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showDecrypted ? 'Hide' : 'Decrypt'}
                    </Button>
                  )}
                </div>
                
                <div className="text-lg font-semibold">
                  {isInitialized ? (
                    showDecrypted && decryptedBalance ? (
                      `${decryptedBalance} ${activeTab.toUpperCase()}`
                    ) : (
                      '[Encrypted Balance]'
                    )
                  ) : (
                    `0 ${activeTab.toUpperCase()}`
                  )}
                </div>
              </div>

              {/* Amount Input */}
              {isInitialized && (
                <div className="space-y-2">
                  <Label htmlFor="withdrawAmount">Amount to Withdraw</Label>
                  <div className="relative">
                    <Input
                      id="withdrawAmount"
                      type="text"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {showDecrypted && decryptedBalance && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={setMaxAmount}
                          className="h-6 px-2 text-xs"
                        >
                          MAX
                        </Button>
                      )}
                      <span className="text-sm text-gray-500">
                        {activeTab.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Messages */}
              {!isInitialized && (
                <div className="flex items-center gap-2 text-sm text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  No balance available to withdraw
                </div>
              )}

              {amount && !hasValidAmount && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  Invalid amount
                </div>
              )}

              {/* Information */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <Wallet className="h-4 w-4 inline mr-2" />
                  {activeTab === 'usdc' ? (
                    'Withdraw deposited USDC from FundPool to your wallet.'
                  ) : (
                    `Withdraw purchased ${tokenInfo.symbol} tokens to your wallet.`
                  )}
                </p>
              </div>

              {/* Withdraw Button */}
              <Button
                onClick={handleWithdraw}
                disabled={!hasValidAmount || !isInitialized || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="mr-2"
                    >
                      ⏳
                    </motion.div>
                    Withdrawing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Withdraw {activeTab.toUpperCase()}
                  </>
                )}
              </Button>

              {/* Note */}
              <div className="text-xs text-gray-500 text-center">
                <p>
                  Withdrawals require proof that the amount matches your encrypted balance.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}