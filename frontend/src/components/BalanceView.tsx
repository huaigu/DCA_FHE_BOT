'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWalletStore } from '@/lib/store'
import { decryptUserBalance } from '@/utils/fheEncryption'
import { formatCurrency, formatNumber, formatAddress } from '@/lib/utils'
import { 
  Eye, 
  EyeOff, 
  Shield, 
  Wallet, 
  TrendingUp, 
  DollarSign,
  Loader2,
  RefreshCw,
  Lock,
  Unlock
} from 'lucide-react'

interface EncryptedBalance {
  token: string
  symbol: string
  encryptedAmount: string
  isDecrypted: boolean
  decryptedAmount?: bigint
  lastUpdated: number
}

interface UserStats {
  totalInvested: number
  totalReceived: number
  activeIntents: number
  completedIntents: number
  averagePrice: number
}

export function BalanceView() {
  const { isConnected, address, signer } = useWalletStore()
  const [balances, setBalances] = useState<EncryptedBalance[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState<{ [key: string]: boolean }>({})
  const [showDecrypted, setShowDecrypted] = useState<{ [key: string]: boolean }>({})
  const [error, setError] = useState<string | null>(null)

  // Mock contract address - in real app this would come from environment
  const contractAddress = '0x' + '0'.repeat(40)

  useEffect(() => {
    if (isConnected && address) {
      loadUserData()
    }
  }, [isConnected, address])

  const loadUserData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Mock data - in real app this would come from smart contract
      const mockBalances: EncryptedBalance[] = [
        {
          token: 'ETH',
          symbol: 'ETH',
          encryptedAmount: '0x' + 'a'.repeat(64), // Mock encrypted value
          isDecrypted: false,
          lastUpdated: Date.now() - 300000, // 5 minutes ago
        },
        {
          token: 'USDC',
          symbol: 'USDC',
          encryptedAmount: '0x' + 'b'.repeat(64), // Mock encrypted value
          isDecrypted: false,
          lastUpdated: Date.now() - 180000, // 3 minutes ago
        },
      ]

      const mockStats: UserStats = {
        totalInvested: 5420.50,
        totalReceived: 2.847,
        activeIntents: 2,
        completedIntents: 8,
        averagePrice: 1905.25,
      }

      setBalances(mockBalances)
      setUserStats(mockStats)
    } catch (error) {
      console.error('Failed to load user data:', error)
      setError('Failed to load balance data')
    } finally {
      setIsLoading(false)
    }
  }

  const decryptBalance = async (index: number) => {
    if (!signer) {
      setError('Wallet not connected')
      return
    }

    const balance = balances[index]
    setIsDecrypting(prev => ({ ...prev, [balance.token]: true }))
    setError(null)

    try {
      // In a real app, this would decrypt the actual encrypted balance
      // For demo purposes, we'll simulate the decryption with mock values
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate decryption time
      
      const mockDecryptedAmounts: { [key: string]: bigint } = {
        'ETH': BigInt(2847000000000000000), // 2.847 ETH
        'USDC': BigInt(1247500000), // 1247.50 USDC
      }

      const decryptedAmount = mockDecryptedAmounts[balance.token]

      setBalances(prev => prev.map((b, i) => 
        i === index 
          ? { ...b, isDecrypted: true, decryptedAmount }
          : b
      ))

      setShowDecrypted(prev => ({ ...prev, [balance.token]: true }))
    } catch (error) {
      console.error('Failed to decrypt balance:', error)
      setError(`Failed to decrypt ${balance.symbol} balance`)
    } finally {
      setIsDecrypting(prev => ({ ...prev, [balance.token]: false }))
    }
  }

  const toggleBalanceVisibility = (token: string) => {
    setShowDecrypted(prev => ({ ...prev, [token]: !prev[token] }))
  }

  const formatTokenAmount = (amount: bigint, symbol: string): string => {
    if (symbol === 'ETH') {
      return formatNumber(Number(amount) / 1e18, 6) + ' ETH'
    } else if (symbol === 'USDC') {
      return formatCurrency(Number(amount) / 1e6)
    }
    return amount.toString()
  }

  if (!isConnected) {
    return (
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Wallet className="w-6 h-6" />
            Encrypted Balance View
          </CardTitle>
          <CardDescription>
            Connect your wallet to view your encrypted token balances
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Please connect your wallet to access your encrypted balances
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Stats Overview */}
      {userStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                DCA Performance Overview
              </CardTitle>
              <CardDescription>
                Your dollar-cost averaging statistics and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(userStats.totalInvested)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Invested
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatNumber(userStats.totalReceived, 3)} ETH
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ETH Received
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {userStats.activeIntents}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Active Intents
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {userStats.completedIntents}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Completed
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(userStats.averagePrice)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Avg. ETH Price
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

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
                <CardDescription>
                  Your confidential token balances from DCA executions
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadUserData}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <p className="text-sm text-red-800">{error}</p>
              </motion.div>
            )}

            <div className="space-y-4">
              {balances.map((balance, index) => (
                <motion.div
                  key={balance.token}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {balance.symbol.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{balance.symbol}</div>
                        <div className="text-sm text-muted-foreground">
                          {balance.token}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        {balance.isDecrypted && showDecrypted[balance.token] ? (
                          <div className="font-mono text-lg">
                            {formatTokenAmount(balance.decryptedAmount!, balance.symbol)}
                          </div>
                        ) : (
                          <div className="font-mono text-lg text-muted-foreground">
                            {'*'.repeat(12)}
                          </div>
                        )}
                        
                        <div className="flex gap-1">
                          {balance.isDecrypted ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleBalanceVisibility(balance.token)}
                            >
                              {showDecrypted[balance.token] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => decryptBalance(index)}
                              disabled={isDecrypting[balance.token]}
                            >
                              {isDecrypting[balance.token] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Unlock className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mt-1">
                        Updated {new Date(balance.lastUpdated).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  {/* Encryption Status */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {balance.isDecrypted ? (
                          <>
                            <Unlock className="w-3 h-3 text-green-500" />
                            <span className="text-green-600">Decrypted locally</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-blue-500" />
                            <span className="text-blue-600">Encrypted on-chain</span>
                          </>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {formatAddress(balance.encryptedAmount)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {balances.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  No token balances found. Submit a DCA intent to start receiving tokens.
                </p>
              </div>
            )}
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
                  Your token balances are encrypted on-chain using FHE technology. 
                  Only you can decrypt and view your actual balances using your private key. 
                  All DCA operations maintain complete privacy of individual amounts and strategies.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}