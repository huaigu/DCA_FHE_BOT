"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/lib/store";
import { useFundPool } from "@/hooks/useFundPool";
import { useBatchProcessor } from "@/hooks/useBatchProcessor";
import { useUSDC } from "@/hooks/useUSDC";
import { useIntentCollector } from "@/hooks/useIntentCollector";
import { SEPOLIA_CONTRACTS } from "@/config/contracts";
import { WithdrawModal } from "./WithdrawModal";
import { WithdrawalStatusBadge } from "./WithdrawalStatusBadge";
import { useToast } from "@/lib/hooks/use-toast";
import { Eye, EyeOff, Shield, Wallet, TrendingUp, Loader2, RefreshCw, Lock, Unlock, Download } from "lucide-react";

interface DecryptedBalance {
  value: string;
  isVisible: boolean;
}

export function BalanceView() {
  const { isConnected } = useWalletStore();
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [decryptedBalances, setDecryptedBalances] = useState<{ [key: string]: DecryptedBalance }>({});
  const [isDecrypting, setIsDecrypting] = useState<{ [key: string]: boolean }>({});
  const [fundPoolUsdcBalance, setFundPoolUsdcBalance] = useState<bigint>(BigInt(0));
  const { toast } = useToast();

  // Hooks
  const {
    totalPoolBalance,
    initiateWithdrawal: initiateUsdcWithdrawal,
    isPendingWithdrawal: isPendingUsdcWithdrawal,
    refetchBalance: refetchFundPoolBalance,
    isLoading: isFundPoolLoading,
  } = useFundPool();

  const {
    totalEthBalance,
    isWithdrawing,
    pendingEthWithdrawal,
    withdrawEth,
    checkWithdrawalStatus,
    refreshAll: refreshBatchProcessor,
    isLoading: isBatchProcessorLoading,
  } = useBatchProcessor();

  const {
    balance: usdcBalance,
    formatAmount: formatUSDCAmount,
    refetchBalance: refetchUSDCBalance,
    getBalanceOf: getUSDCBalanceOf,
  } = useUSDC();

  const { refetchUserIntents } = useIntentCollector();

  const isLoading = isFundPoolLoading || isBatchProcessorLoading;

  // Token info for ETH
  const tokenInfo = {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  };

  /**
   * Fetch FundPool contract's USDC balance
   */
  const fetchFundPoolUsdcBalance = useCallback(async () => {
    if (getUSDCBalanceOf && SEPOLIA_CONTRACTS.FUND_POOL) {
      try {
        const balance = await getUSDCBalanceOf(SEPOLIA_CONTRACTS.FUND_POOL);
        setFundPoolUsdcBalance(balance);
      } catch (error) {
        console.error("Failed to fetch FundPool USDC balance:", error);
      }
    }
  }, [getUSDCBalanceOf]);

  // Fetch FundPool USDC balance on mount and when connected
  useEffect(() => {
    if (isConnected) {
      void fetchFundPoolUsdcBalance();
    }
  }, [fetchFundPoolUsdcBalance, isConnected]);

  /**
   * Refresh all balance data
   */
  const refreshAllBalances = useCallback(async () => {
    await Promise.all([
      refetchFundPoolBalance(),
      refreshBatchProcessor(),
      refetchUSDCBalance(),
      refetchUserIntents(),
      checkWithdrawalStatus(),
      fetchFundPoolUsdcBalance(),
    ]);
  }, [
    refetchFundPoolBalance,
    refreshBatchProcessor,
    refetchUSDCBalance,
    refetchUserIntents,
    checkWithdrawalStatus,
    fetchFundPoolUsdcBalance,
  ]);

  // Auto-refresh when there are pending withdrawals
  useEffect(() => {
    if (pendingEthWithdrawal || isPendingUsdcWithdrawal) {
      const interval = setInterval(() => {
        void checkWithdrawalStatus();
        void refetchFundPoolBalance(); // Also refresh FundPool status
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    }
  }, [pendingEthWithdrawal, isPendingUsdcWithdrawal, checkWithdrawalStatus, refetchFundPoolBalance]);

  /**
   * Simulate balance decryption
   */
  const decryptBalance = useCallback(async (tokenType: "usdc" | "weth") => {
    setIsDecrypting((prev) => ({ ...prev, [tokenType]: true }));

    try {
      // Simulate decryption delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock decrypted values
      const mockDecrypted = {
        usdc: (Math.random() * 1000 + 100).toFixed(2), // Random USDC amount
        weth: (Math.random() * 5 + 0.5).toFixed(4), // Random WETH amount
      };

      setDecryptedBalances((prev) => ({
        ...prev,
        [tokenType]: {
          value: mockDecrypted[tokenType],
          isVisible: true,
        },
      }));
    } catch (error) {
      console.error("Decryption failed:", error);
    } finally {
      setIsDecrypting((prev) => ({ ...prev, [tokenType]: false }));
    }
  }, []);

  /**
   * Toggle balance visibility
   */
  const toggleBalanceVisibility = useCallback((tokenType: string) => {
    setDecryptedBalances((prev) => ({
      ...prev,
      [tokenType]: {
        ...prev[tokenType],
        isVisible: !prev[tokenType]?.isVisible,
      },
    }));
  }, []);

  /**
   * Get balance display for a token type
   */
  const getBalanceDisplay = useCallback(
    (tokenType: "usdc" | "weth") => {
      const decrypted = decryptedBalances[tokenType];

      if (decrypted && decrypted.isVisible) {
        return tokenType === "usdc" ? `${decrypted.value} USDC` : `${decrypted.value} ${tokenInfo.symbol}`;
      }

      return "[Encrypted Balance]";
    },
    [decryptedBalances, tokenInfo.symbol],
  );

  /**
   * Check if balance is decrypted
   */
  const isBalanceDecrypted = useCallback(
    (tokenType: string) => {
      return !!decryptedBalances[tokenType]?.value;
    },
    [decryptedBalances],
  );

  if (!isConnected) {
    return (
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Wallet className="w-6 h-6" />
            Encrypted Balance View
          </CardTitle>
          <CardDescription>Connect your wallet to view your encrypted token balances</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">Please connect your wallet to access your encrypted balances</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* DCA Statistics Overview */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              DCA Activity Overview
            </CardTitle>
            <CardDescription>Your dollar-cost averaging activity and account status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{formatUSDCAmount(usdcBalance)}</div>
                <div className="text-sm text-muted-foreground">Your USDC Wallet</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatUSDCAmount(fundPoolUsdcBalance.toString())}
                </div>
                <div className="text-sm text-muted-foreground">FundPool Total USDC</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {(Number(totalEthBalance) / 1e18).toFixed(4)} ETH
                </div>
                <div className="text-sm text-muted-foreground">BatchProcessor Total ETH</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Encrypted Balances */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Encrypted Token Balances
                </CardTitle>
                <CardDescription>Your confidential token balances from DCA executions</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={refreshAllBalances} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {/* USDC FundPool Balance */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      $
                    </div>
                    <div>
                      <div className="font-medium">USDC</div>
                      <div className="text-sm text-muted-foreground">FundPool Balance</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {/* Withdraw Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              // Use FundPool initiateWithdrawal function (2-step process)
                              await initiateUsdcWithdrawal();
                              toast({
                                title: "USDC Withdrawal Initiated",
                                description: "Step 1 complete. Waiting for FHE decryption callback...",
                              });
                            } catch (error) {
                              console.error("USDC withdrawal failed:", error);
                              toast({
                                title: "Withdrawal Failed",
                                description: error instanceof Error ? error.message : "Unknown error occurred.",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={isFundPoolLoading || isPendingUsdcWithdrawal}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          {isPendingUsdcWithdrawal ? 'Pending' : 'Withdraw'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Encryption Status */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-blue-500" />
                      <span className="text-blue-600">Encrypted on-chain</span>
                    </div>
                    <div className="text-muted-foreground text-xs">Can withdraw anytime</div>
                  </div>
                </div>
              </motion.div>

              {/* ETH Token Balance */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      Ξ
                    </div>
                    <div>
                      <div className="font-medium">ETH</div>
                      <div className="text-sm text-muted-foreground">Ethereum</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <WithdrawalStatusBadge type="eth" isPending={!!pendingEthWithdrawal} />
                      <div className="flex gap-1">
                        {/* Withdraw Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await withdrawEth();
                              toast({
                                title: "ETH Withdrawal Initiated",
                                description: "Step 1 complete. Waiting for FHE decryption callback...",
                              });
                            } catch (error) {
                              console.error("ETH withdrawal failed:", error);
                              toast({
                                title: "Withdrawal Failed",
                                description: error instanceof Error ? error.message : "Unknown error occurred.",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={isWithdrawing || !!pendingEthWithdrawal}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          {pendingEthWithdrawal ? "Pending" : "Withdraw"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Encryption Status */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-blue-500" />
                      <span className="text-blue-600">Encrypted on-chain</span>
                    </div>
                    <div className="text-muted-foreground text-xs">Can withdraw anytime</div>
                  </div>
                  {/* Total ETH in BatchProcessor */}
                  <div className="text-xs text-blue-600 mt-2">
                    Total Pool ETH: {(Number(totalEthBalance) / 1e18).toFixed(4)} ETH
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Note: Always show encrypted balances - user can attempt withdrawal anytime */}
          </CardContent>
        </Card>
      </motion.div>

      {/* Privacy Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Privacy Protection</p>
                <p className="text-blue-800">
                  Your token balances are encrypted on-chain using FHE technology. Since the exact amounts are unknown
                  until decryption, you can always attempt withdrawal - the contract will handle empty balances
                  gracefully. All DCA operations maintain complete privacy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={refreshAllBalances}
      />
    </div>
  );
}
