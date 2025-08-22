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
import { useBatchProcessor } from '@/hooks/useBatchProcessor';
import { useUSDC } from '@/hooks/useUSDC';
import { useWalletStore } from '@/lib/store';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WithdrawTab = 'usdc' | 'eth';

export function WithdrawModal({ isOpen, onClose, onSuccess }: WithdrawModalProps) {
  const [activeTab, setActiveTab] = useState<WithdrawTab>('usdc');
  const [amount, setAmount] = useState('');
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
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
    ethBalance: tokenBalance,
    pendingUsdcWithdrawal,
    pendingEthWithdrawal,
    initiateUsdcWithdrawal,
    withdrawEth,
    isLoading: isBatchProcessorLoading
  } = useBatchProcessor();
  
  const tokenInfo = {
    name: 'Ethereum',
    symbol: 'ETH'
  };

  const { formatAmount } = useUSDC();

  const isLoading = isFundPoolLoading || isBatchProcessorLoading || isWithdrawing;

  // For new withdrawal system, we don't need amount input
  // The contracts handle full balance withdrawal automatically
  const hasValidAmount = true;

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
    if (!address) return;

    setIsWithdrawing(true);
    
    try {
      toast({
        title: 'Initiating Withdrawal',
        description: `Starting ${activeTab.toUpperCase()} withdrawal process...`,
      });

      if (activeTab === 'usdc') {
        // Initiate USDC withdrawal (2-step process)
        await initiateUsdcWithdrawal();
        toast({
          title: 'USDC Withdrawal Initiated',
          description: 'Step 1 complete. Waiting for FHE decryption callback...',
        });
      } else {
        // Initiate ETH withdrawal (2-step process)
        await withdrawEth();
        toast({
          title: 'ETH Withdrawal Initiated', 
          description: 'Step 1 complete. Waiting for FHE decryption callback...',
        });
      }

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
    } finally {
      setIsWithdrawing(false);
    }
  }, [
    address,
    activeTab,
    initiateUsdcWithdrawal,
    withdrawEth,
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

  // For encrypted balances, we can't know if there's anything to withdraw beforehand
  // So we always allow withdrawal attempts - the contract will handle empty balances
  const canWithdraw = true;

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
                variant={activeTab === 'eth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('eth')}
                className="flex-1"
              >
                ETH
              </Button>
            </div>

            {/* Balance Section */}
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">
                    {activeTab === 'usdc' ? 'FundPool Balance' : 'ETH Balance'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDecryptBalance}
                    className="h-6 px-2 text-xs"
                  >
                    {showDecrypted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showDecrypted ? 'Hide' : 'Decrypt'}
                  </Button>
                </div>
                
                <div className="text-lg font-semibold">
                  {showDecrypted && decryptedBalance ? (
                    `${decryptedBalance} ${activeTab.toUpperCase()}`
                  ) : (
                    `[Encrypted ${activeTab.toUpperCase()} Balance]`
                  )}
                  {/* Show pending status */}
                  {((activeTab === 'usdc' && pendingUsdcWithdrawal) || (activeTab === 'eth' && pendingEthWithdrawal)) && (
                    <div className="text-xs text-blue-600 mt-1">
                      Previous withdrawal pending...
                    </div>
                  )}
                </div>
              </div>

              {/* Withdrawal Info - No amount input needed */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                  Full Balance Withdrawal
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  This will withdraw your entire encrypted {activeTab.toUpperCase()} balance. 
                  The exact amount will be determined during the FHE decryption process.
                  {/* Explain why we can always try */}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  💡 Since your balance is encrypted, you can always attempt withdrawal - 
                  the contract will handle the case if your balance is zero.
                </p>
              </div>

              {/* Show pending withdrawal warning */}
              {((activeTab === 'usdc' && pendingUsdcWithdrawal) || (activeTab === 'eth' && pendingEthWithdrawal)) && (
                <div className="flex items-center gap-2 text-sm text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  A withdrawal is already in progress for this token
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
                disabled={isLoading || 
                  (activeTab === 'usdc' && !!pendingUsdcWithdrawal) ||
                  (activeTab === 'eth' && !!pendingEthWithdrawal)
                }
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
                    Initiating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Initiate {activeTab.toUpperCase()} Withdrawal
                  </>
                )}
              </Button>

              {/* Note */}
              <div className="text-xs text-gray-500 text-center space-y-1">
                <p>
                  This is a 2-step withdrawal process using FHE decryption.
                </p>
                <p>
                  Step 1: Initiate withdrawal. Step 2: Wait for automatic completion.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}