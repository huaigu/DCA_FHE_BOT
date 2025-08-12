'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useWalletStore } from '@/lib/store'
import { initializeFHE } from '@/utils/fheEncryption'
import { formatAddress } from '@/lib/utils'
import { 
  Wallet, 
  LogOut, 
  AlertTriangle, 
  Loader2,
  Shield,
  CheckCircle
} from 'lucide-react'

export function WalletConnect() {
  const {
    isConnected,
    address,
    chainId,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    clearError,
    provider
  } = useWalletStore()

  // Initialize FHE when wallet connects
  useEffect(() => {
    if (isConnected && provider) {
      initializeFHE(provider).catch(error => {
        console.error('Failed to initialize FHE:', error)
      })
    }
  }, [isConnected, provider])

  // Auto-clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  if (isConnected && address) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">
            {formatAddress(address)}
          </span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
        
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <Shield className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            FHE Ready
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={disconnectWallet}
          className="hover:bg-red-50 hover:border-red-200"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={connectWallet}
        disabled={isConnecting}
        size="lg"
        className="w-full sm:w-auto"
      >
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

      {!isConnected && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Connect to Sepolia testnet to use the DCA bot
          </p>
        </div>
      )}
    </div>
  )
}