"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/lib/store";
import { useUSDC } from "@/hooks/useUSDC";
import { initializeFHE } from "@/utils/fheEncryption";
import { formatAddress } from "@/lib/utils";
import { SEPOLIA_CONFIG } from "@/config/contracts";
import { Wallet, LogOut, AlertTriangle, Loader2, Shield, CheckCircle, DollarSign, RefreshCw, Network } from "lucide-react";

export function WalletConnect() {
  const { 
    isConnected, 
    address, 
    chainId, 
    isConnecting, 
    isNetworkSwitching,
    error, 
    connectWallet, 
    disconnectWallet, 
    switchToSepolia,
    clearError, 
    provider 
  } = useWalletStore();

  // USDC balance hook
  const { balance: usdcBalance, formatAmount: formatUSDCAmount, isBalanceLoading, refetchBalance } = useUSDC();

  // Initialize FHE when wallet connects
  useEffect(() => {
    if (isConnected && provider) {
      initializeFHE().catch((error) => {
        console.error("Failed to initialize FHE:", error);
      });
    }
  }, [isConnected, provider]);

  // Auto-clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Check if on correct network
  const isCorrectNetwork = chainId === SEPOLIA_CONFIG.chainId;

  if (isConnected && address) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto"
      >
        {/* Network Status - show if not on correct network */}
        {!isCorrectNetwork && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <span className="text-sm font-medium text-orange-800">Wrong Network</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={switchToSepolia}
              disabled={isNetworkSwitching}
              className="h-auto p-1 hover:bg-orange-100 flex-shrink-0"
            >
              {isNetworkSwitching ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Switch"
              )}
            </Button>
          </div>
        )}

        {/* USDC Balance Display - only show if on correct network */}
        {isCorrectNetwork && (
          <div className="flex items-center justify-between sm:justify-start gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg min-w-0 flex-1 sm:flex-none">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm font-mono text-green-800 truncate">
                {isBalanceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : formatUSDCAmount(usdcBalance)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refetchBalance}
              disabled={isBalanceLoading}
              className="h-auto p-1 hover:bg-green-100 flex-shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${isBalanceLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Wallet Address */}
          <div className={`flex items-center gap-2 px-3 py-2 border rounded-lg min-w-0 flex-1 sm:flex-none ${
            isCorrectNetwork 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <CheckCircle className={`w-4 h-4 flex-shrink-0 ${
              isCorrectNetwork ? 'text-blue-600' : 'text-gray-500'
            }`} />
            <span className={`text-sm font-medium truncate ${
              isCorrectNetwork ? 'text-blue-800' : 'text-gray-600'
            }`}>
              {formatAddress(address)}
            </span>
            <div className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${
              isCorrectNetwork ? 'bg-blue-500' : 'bg-gray-400'
            }`} />
          </div>

          {/* FHE Status - hidden on small screens, only show if connected to correct network */}
          {isCorrectNetwork && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
              <Shield className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">FHE Ready</span>
            </div>
          )}

          {/* Disconnect Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={disconnectWallet}
            className="hover:bg-red-50 hover:border-red-200 flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <Button onClick={connectWallet} disabled={isConnecting} size="lg" className="w-full sm:w-auto">
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </>
        )}
      </Button>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-800">{error}</span>
        </motion.div>
      )}
    </div>
  );
}
