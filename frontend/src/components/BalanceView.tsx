'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWalletStore } from '@/lib/store'
import { useFundPool } from '@/hooks/useFundPool'
import { useConfidentialToken } from '@/hooks/useConfidentialToken'
import { useUSDC } from '@/hooks/useUSDC'
import { useIntentCollector } from '@/hooks/useIntentCollector'
import { WithdrawModal } from './WithdrawModal'
import { TOKEN_METADATA } from '@/config/contracts'
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
  Unlock,
  Download
} from 'lucide-react'

interface DecryptedBalance {
  value: string
  isVisible: boolean
}

export function BalanceView() {
  const { isConnected, address } = useWalletStore()
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [decryptedBalances, setDecryptedBalances] = useState<{ [key: string]: DecryptedBalance }>({})
  const [isDecrypting, setIsDecrypting] = useState<{ [key: string]: boolean }>({})
  
  // Hooks
  const {
    balance: fundPoolBalance,
    refetchBalance: refetchFundPoolBalance,
    formatBalance,
    isLoading: isFundPoolLoading
  } = useFundPool()
  
  const {
    balance: tokenBalance,
    tokenInfo,
    refetchBalance: refetchTokenBalance,
    formatEncryptedBalance,
    isLoading: isTokenLoading
  } = useConfidentialToken()
  
  const {
    balance: usdcBalance,
    formatAmount: formatUSDCAmount,
    refetchBalance: refetchUSDCBalance
  } = useUSDC()
  
  const {
    userIntentIds,
    refetchUserIntents
  } = useIntentCollector()
  
  const isLoading = isFundPoolLoading || isTokenLoading

  /**
   * Refresh all balance data
   */
  const refreshAllBalances = useCallback(async () => {
    await Promise.all([
      refetchFundPoolBalance(),
      refetchTokenBalance(),
      refetchUSDCBalance(),
      refetchUserIntents()
    ])
  }, [refetchFundPoolBalance, refetchTokenBalance, refetchUSDCBalance, refetchUserIntents])

  /**
   * Simulate balance decryption
   */
  const decryptBalance = useCallback(async (tokenType: 'usdc' | 'weth') => {
    setIsDecrypting(prev => ({ ...prev, [tokenType]: true }))
    
    try {
      // Simulate decryption delay
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Mock decrypted values
      const mockDecrypted = {
        usdc: (Math.random() * 1000 + 100).toFixed(2), // Random USDC amount
        weth: (Math.random() * 5 + 0.5).toFixed(4)     // Random WETH amount
      }
      
      setDecryptedBalances(prev => ({
        ...prev,
        [tokenType]: {
          value: mockDecrypted[tokenType],
          isVisible: true
        }
      }))
    } catch (error) {
      console.error('Decryption failed:', error)
    } finally {
      setIsDecrypting(prev => ({ ...prev, [tokenType]: false }))
    }
  }, [])

  /**
   * Toggle balance visibility
   */
  const toggleBalanceVisibility = useCallback((tokenType: string) => {
    setDecryptedBalances(prev => ({
      ...prev,
      [tokenType]: {
        ...prev[tokenType],
        isVisible: !prev[tokenType]?.isVisible
      }
    }))
  }, [])

  /**
   * Get balance display for a token type
   */
  const getBalanceDisplay = useCallback((tokenType: 'usdc' | 'weth') => {
    const decrypted = decryptedBalances[tokenType]
    
    if (decrypted && decrypted.isVisible) {
      return tokenType === 'usdc' ? 
        `${decrypted.value} USDC` : 
        `${decrypted.value} ${tokenInfo.symbol}`
    }
    
    return '[Encrypted Balance]'
  }, [decryptedBalances, tokenInfo.symbol])
  
  /**
   * Check if balance is decrypted
   */
  const isBalanceDecrypted = useCallback((tokenType: string) => {
    return !!decryptedBalances[tokenType]?.value
  }, [decryptedBalances])

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
      {/* DCA Statistics Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              DCA Activity Overview
            </CardTitle>
            <CardDescription>
              Your dollar-cost averaging activity and account status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatUSDCAmount(usdcBalance)}
                </div>
                <div className="text-sm text-muted-foreground">
                  USDC Wallet
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {fundPoolBalance.isInitialized ? '[Encrypted]' : '0'}
                </div>
                <div className="text-sm text-muted-foreground">
                  FundPool Balance
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {userIntentIds.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Intents
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {tokenBalance.isInitialized ? '[Encrypted]' : '0'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {tokenInfo.symbol} Received
                </div>
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
                <CardDescription>
                  Your confidential token balances from DCA executions
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWithdrawModal(true)}
                  disabled={!fundPoolBalance.isInitialized && !tokenBalance.isInitialized}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Withdraw
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshAllBalances}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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
                      <div className="text-sm text-muted-foreground">
                        FundPool Balance
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-lg">
                        {isBalanceDecrypted('usdc') && decryptedBalances.usdc?.isVisible ? 
                          getBalanceDisplay('usdc') : 
                          (fundPoolBalance.isInitialized ? '[Encrypted]' : '0 USDC')
                        }
                      </div>
                      
                      {fundPoolBalance.isInitialized && (
                        <div className="flex gap-1">
                          {isBalanceDecrypted('usdc') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleBalanceVisibility('usdc')}
                            >
                              {decryptedBalances.usdc?.isVisible ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => decryptBalance('usdc')}
                              disabled={isDecrypting.usdc}
                            >
                              {isDecrypting.usdc ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Unlock className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Encryption Status */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {fundPoolBalance.isInitialized ? (
                        <>
                          <Lock className="w-3 h-3 text-blue-500" />
                          <span className="text-blue-600">Encrypted on-chain</span>
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-3 h-3 text-gray-500" />
                          <span className="text-gray-600">No deposits yet</span>
                        </>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Available for DCA strategies
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* WETH Token Balance */}
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
                      <div className="font-medium">{tokenInfo.symbol}</div>
                      <div className="text-sm text-muted-foreground">
                        {tokenInfo.name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-lg">
                        {isBalanceDecrypted('weth') && decryptedBalances.weth?.isVisible ? 
                          getBalanceDisplay('weth') : 
                          (tokenBalance.isInitialized ? '[Encrypted]' : `0 ${tokenInfo.symbol}`)
                        }
                      </div>
                      
                      {tokenBalance.isInitialized && (
                        <div className="flex gap-1">
                          {isBalanceDecrypted('weth') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleBalanceVisibility('weth')}
                            >
                              {decryptedBalances.weth?.isVisible ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => decryptBalance('weth')}
                              disabled={isDecrypting.weth}
                            >
                              {isDecrypting.weth ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Unlock className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Encryption Status */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {tokenBalance.isInitialized ? (
                        <>
                          <Lock className="w-3 h-3 text-blue-500" />
                          <span className="text-blue-600">Encrypted on-chain</span>
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-3 h-3 text-gray-500" />
                          <span className="text-gray-600">No tokens received yet</span>
                        </>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      From DCA executions
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {!fundPoolBalance.isInitialized && !tokenBalance.isInitialized && (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  No encrypted balances found. Deposit USDC and create a DCA intent to start.
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

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={refreshAllBalances}
      />
    </div>
  )
}