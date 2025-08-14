'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/use-toast';
import { useUSDC } from '@/hooks/useUSDC';
import { useFundPool } from '@/hooks/useFundPool';
import { useWalletStore } from '@/lib/store';
import { SEPOLIA_CONTRACTS } from '@/config/contracts';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DepositModal({ isOpen, onClose, onSuccess }: DepositModalProps) {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'input' | 'approve' | 'deposit' | 'success'>('input');
  const { toast } = useToast();
  const { address } = useWalletStore();

  // USDC operations
  const {
    balance: usdcBalance,
    allowance,
    needsApproval,
    approve,
    approveMax,
    formatAmount,
    parseAmount,
    isLoading: isUSDCLoading
  } = useUSDC();

  // FundPool operations
  const {
    deposit,
    balance: fundPoolBalance,
    isLoading: isFundPoolLoading
  } = useFundPool();

  const isLoading = isUSDCLoading || isFundPoolLoading;

  // Parse input amount
  const parsedAmount = parseAmount(amount);
  const hasValidAmount = parsedAmount > 0;
  const hasSufficientBalance = usdcBalance >= parsedAmount;
  const requiresApproval = hasValidAmount && needsApproval(parsedAmount);

  /**
   * Handle deposit flow
   */
  const handleDeposit = useCallback(async () => {
    if (!hasValidAmount || !hasSufficientBalance || !address) return;

    try {
      // Step 1: Approve if needed
      if (requiresApproval) {
        setStep('approve');
        toast({
          title: 'Approval Required',
          description: 'Please approve USDC spending for the FundPool contract.',
        });

        await approve(parsedAmount);
        
        toast({
          title: 'Approval Successful',
          description: 'USDC spending approved. Proceeding with deposit...',
        });
      }

      // Step 2: Deposit to FundPool
      setStep('deposit');
      toast({
        title: 'Processing Deposit',
        description: 'Depositing USDC to FundPool with encryption...',
      });

      await deposit(
        parsedAmount,
        SEPOLIA_CONTRACTS.FUND_POOL,
        address
      );

      // Step 3: Success
      setStep('success');
      toast({
        title: 'Deposit Successful',
        description: `Successfully deposited ${formatAmount(parsedAmount)} to FundPool.`,
      });

      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
        onSuccess?.();
      }, 2000);

    } catch (error) {
      console.error('Deposit failed:', error);
      toast({
        title: 'Deposit Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
        variant: 'destructive',
      });
      setStep('input');
    }
  }, [
    hasValidAmount,
    hasSufficientBalance,
    address,
    requiresApproval,
    parsedAmount,
    approve,
    deposit,
    formatAmount,
    toast,
    onSuccess
  ]);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    if (isLoading) return;
    setAmount('');
    setStep('input');
    onClose();
  }, [isLoading, onClose]);

  /**
   * Set maximum amount
   */
  const setMaxAmount = useCallback(() => {
    const maxAmount = formatAmount(usdcBalance, false);
    setAmount(maxAmount);
  }, [usdcBalance, formatAmount]);

  if (!isOpen) return null;

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
              <h2 className="text-xl font-semibold">Deposit USDC</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content based on step */}
            {step === 'input' && (
              <div className="space-y-4">
                {/* Balance Info */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>USDC Balance:</span>
                    <span className="font-medium">
                      {formatAmount(usdcBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>FundPool Balance:</span>
                    <span className="font-medium">
                      {fundPoolBalance.encrypted !== '0' ? '[Encrypted]' : '0 USDC'}
                    </span>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount to Deposit</Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="text"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={setMaxAmount}
                        className="h-6 px-2 text-xs"
                      >
                        MAX
                      </Button>
                      <span className="text-sm text-gray-500">USDC</span>
                    </div>
                  </div>
                </div>

                {/* Validation Messages */}
                {amount && !hasValidAmount && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertTriangle className="h-4 w-4" />
                    Invalid amount
                  </div>
                )}

                {hasValidAmount && !hasSufficientBalance && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertTriangle className="h-4 w-4" />
                    Insufficient USDC balance
                  </div>
                )}

                {requiresApproval && hasValidAmount && hasSufficientBalance && (
                  <div className="flex items-center gap-2 text-sm text-blue-500">
                    <Wallet className="h-4 w-4" />
                    Approval required for USDC spending
                  </div>
                )}

                {/* Deposit Button */}
                <Button
                  onClick={handleDeposit}
                  disabled={!hasValidAmount || !hasSufficientBalance || isLoading}
                  className="w-full"
                >
                  {requiresApproval ? 'Approve & Deposit' : 'Deposit'} USDC
                </Button>
              </div>
            )}

            {/* Approval Step */}
            {step === 'approve' && (
              <div className="space-y-4 text-center">
                <div className="p-4">
                  <Wallet className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                  <h3 className="text-lg font-medium mb-2">Approving USDC</h3>
                  <p className="text-sm text-gray-500">
                    Please confirm the approval transaction in your wallet
                  </p>
                </div>
                <Button disabled className="w-full">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mr-2"
                  >
                    ⏳
                  </motion.div>
                  Approving...
                </Button>
              </div>
            )}

            {/* Deposit Step */}
            {step === 'deposit' && (
              <div className="space-y-4 text-center">
                <div className="p-4">
                  <ArrowRight className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-medium mb-2">Depositing to FundPool</h3>
                  <p className="text-sm text-gray-500">
                    Encrypting and depositing {formatAmount(parsedAmount)}
                  </p>
                </div>
                <Button disabled className="w-full">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mr-2"
                  >
                    ⏳
                  </motion.div>
                  Depositing...
                </Button>
              </div>
            )}

            {/* Success Step */}
            {step === 'success' && (
              <div className="space-y-4 text-center">
                <div className="p-4">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-medium mb-2">Deposit Successful!</h3>
                  <p className="text-sm text-gray-500">
                    {formatAmount(parsedAmount)} deposited to FundPool
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  Auto-closing in 2 seconds...
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}