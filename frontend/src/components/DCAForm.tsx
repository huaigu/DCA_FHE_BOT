'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/hooks/use-toast'
import { useWalletStore } from '@/lib/store'
import { useIntentCollector } from '@/hooks/useIntentCollector'
import { useFundPool } from '@/hooks/useFundPool'
import { useUSDC } from '@/hooks/useUSDC'
import { SEPOLIA_CONTRACTS, DCA_CONFIG, TOKEN_METADATA } from '@/config/contracts'
import { Loader2, Shield, DollarSign, Clock, TrendingUp, Wallet, ArrowDown, Settings } from 'lucide-react'
import { DepositModal } from './DepositModal'

interface DCAFormData {
  investmentAmount: string
  tradesCount: string
  amountPerTrade: string
  frequency: string
  minPrice: string
  maxPrice: string
  useAmountMode: boolean // true for "amount per trade", false for "trades count"
}

export function DCAForm() {
  const { isConnected, address } = useWalletStore()
  const { toast } = useToast()
  
  // Hooks
  const { submitIntent, isLoading: isSubmittingIntent } = useIntentCollector()
  const { balance: fundPoolBalance, formatBalance } = useFundPool()
  const { balance: usdcBalance, formatAmount } = useUSDC()
  
  const [formData, setFormData] = useState<DCAFormData>({
    investmentAmount: '',
    tradesCount: '10',
    amountPerTrade: '',
    frequency: '24', // 1 day in hours
    minPrice: '',
    maxPrice: '',
    useAmountMode: false
  })

  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleInputChange = useCallback((field: keyof DCAFormData, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      
      // Auto-calculate based on input mode
      if (field === 'investmentAmount' || field === 'tradesCount' || field === 'amountPerTrade') {
        const investment = field === 'investmentAmount' ? parseFloat(value) : parseFloat(updated.investmentAmount)
        const trades = field === 'tradesCount' ? parseInt(value) : parseInt(updated.tradesCount)
        
        if (!updated.useAmountMode && investment && trades && trades > 0) {
          // Calculate amount per trade from investment and trades
          const calculated = (investment / trades).toFixed(2)
          updated.amountPerTrade = calculated
        }
      }
      
      return updated
    })
  }, [])

  const validateForm = useCallback((): string | null => {
    const { investmentAmount, tradesCount, amountPerTrade, frequency, minPrice, maxPrice } = formData

    if (!investmentAmount || parseFloat(investmentAmount) <= 0) return 'Investment amount must be greater than 0'
    if (!tradesCount || parseInt(tradesCount) <= 0) return 'Number of trades must be greater than 0'
    if (!amountPerTrade || parseFloat(amountPerTrade) <= 0) return 'Amount per trade must be greater than 0'
    if (!frequency || parseInt(frequency) <= 0) return 'Frequency must be greater than 0'
    
    // Check fund pool balance
    const investmentAmountBigInt = BigInt(Math.floor(parseFloat(investmentAmount) * 1e6))
    if (!fundPoolBalance.isInitialized) return 'Please deposit USDC to FundPool first'
    
    // Price conditions are optional
    if (minPrice && maxPrice) {
      if (parseFloat(minPrice) >= parseFloat(maxPrice)) return 'Minimum price must be less than maximum price'
    }

    return null
  }, [formData, fundPoolBalance])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected || !address) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your wallet first',
        variant: 'destructive'
      })
      return
    }

    const validationError = validateForm()
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: validationError,
        variant: 'destructive'
      })
      return
    }

    try {
      // Convert form data to DCA intent parameters
      const intentParams = {
        budget: BigInt(Math.floor(parseFloat(formData.investmentAmount) * 1e6)), // USDC has 6 decimals
        tradesCount: parseInt(formData.tradesCount),
        amountPerTrade: BigInt(Math.floor(parseFloat(formData.amountPerTrade) * 1e6)),
        frequency: parseInt(formData.frequency) * 3600, // Convert hours to seconds
        minPrice: formData.minPrice ? BigInt(Math.floor(parseFloat(formData.minPrice) * 1e8)) : BigInt(0),
        maxPrice: formData.maxPrice ? BigInt(Math.floor(parseFloat(formData.maxPrice) * 1e8)) : BigInt(2**32 - 1) // Max uint32
      }

      toast({
        title: 'Submitting Intent',
        description: 'Encrypting parameters and submitting to batch...'
      })

      // Submit encrypted intent
      const result = await submitIntent(
        intentParams,
        SEPOLIA_CONTRACTS.INTENT_COLLECTOR,
        address
      )

      // Reset form on success
      setFormData({
        investmentAmount: '',
        tradesCount: '10',
        amountPerTrade: '',
        frequency: '24',
        minPrice: '',
        maxPrice: '',
        useAmountMode: false
      })

      toast({
        title: 'Intent Submitted Successfully!',
        description: `Intent ID: ${result.intentId?.toString() || 'Unknown'}`,
      })
    } catch (error) {
      console.error('Failed to submit DCA intent:', error)
      toast({
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      })
    }
  }, [isConnected, address, validateForm, formData, submitIntent, toast])

  // Calculate frequency display
  const getFrequencyDisplay = useCallback((seconds: string): string => {
    const secs = parseInt(seconds)
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`
    return `${Math.floor(secs / 86400)}d`
  }, [])

  // Format currency helper
  const formatCurrency = useCallback((amount: number): string => {
    return amount.toFixed(2)
  }, [])

  // Get available fund pool balance
  const availableBalance = fundPoolBalance.isInitialized ? '[Encrypted Balance]' : '0 USDC'

  if (!isConnected) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Shield className="w-6 h-6" />
            Private DCA Strategy
          </CardTitle>
          <CardDescription>
            Connect your wallet to create encrypted DCA intents
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Please connect your wallet to access the DCA form
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            Create DCA Intent
          </CardTitle>
          <CardDescription>
            Set up your encrypted dollar-cost averaging strategy. All parameters are encrypted for maximum privacy.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Total Budget (USDC)
                </Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="1000"
                  value={formData.investmentAmount}
                  onChange={(e) => handleInputChange('investmentAmount', e.target.value)}
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground">
                  Total amount to invest in USDC
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradesCount">Number of Trades</Label>
                <Input
                  id="tradesCount"
                  type="number"
                  placeholder="10"
                  value={formData.tradesCount}
                  onChange={(e) => handleInputChange('tradesCount', e.target.value)}
                  min="1"
                  step="1"
                />
                <p className="text-xs text-muted-foreground">
                  How many purchases to make
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amountPerTrade" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Amount per Trade (USDC)
                </Label>
                <Input
                  id="amountPerTrade"
                  type="number"
                  placeholder="100"
                  value={formData.amountPerTrade}
                  onChange={(e) => handleInputChange('amountPerTrade', e.target.value)}
                  min="0"
                  step="0.01"
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Automatically calculated: {formData.investmentAmount && formData.tradesCount ? 
                    formatCurrency(parseFloat(formData.investmentAmount) / parseInt(formData.tradesCount)) : 
                    'Enter budget and trades'
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Frequency (hours)
                </Label>
                <Input
                  id="frequency"
                  type="number"
                  placeholder="24"
                  value={formData.frequency}
                  onChange={(e) => handleInputChange('frequency', e.target.value)}
                  min="1"
                  step="1"
                />
                <p className="text-xs text-muted-foreground">
                  Hours between each trade
                </p>
              </div>
            </div>

            {/* Price Range Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Price Conditions (Encrypted)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced
                </Button>
              </div>

              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ 
                  height: showAdvanced ? 'auto' : 0, 
                  opacity: showAdvanced ? 1 : 0 
                }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="minPrice">Minimum ETH Price (USD)</Label>
                    <Input
                      id="minPrice"
                      type="number"
                      placeholder="1500"
                      value={formData.minPrice}
                      onChange={(e) => handleInputChange('minPrice', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground">
                      Only buy when ETH price is above this
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxPrice">Maximum ETH Price (USD)</Label>
                    <Input
                      id="maxPrice"
                      type="number"
                      placeholder="2500"
                      value={formData.maxPrice}
                      onChange={(e) => handleInputChange('maxPrice', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground">
                      Only buy when ETH price is below this
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <Shield className="w-4 h-4 inline mr-2" />
                    Your price range will be encrypted and hidden from all observers. 
                    Only qualifying intents will be executed in each batch.
                  </p>
                </div>
              </motion.div>
            </div>


            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmittingIntent}
              size="lg"
            >
              {isSubmittingIntent ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting to Batch...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Submit Encrypted Intent
                </>
              )}
            </Button>

            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>
                Your intent will be encrypted and added to the next batch.
              </p>
              <p>
                Execution requires {DCA_CONFIG.MIN_BATCH_SIZE}-{DCA_CONFIG.MAX_BATCH_SIZE} users and matching price conditions.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={() => {
          toast({
            title: 'Deposit Successful',
            description: 'USDC deposited to FundPool. You can now create DCA intents.'
          })
        }}
      />
    </motion.div>
  )
}