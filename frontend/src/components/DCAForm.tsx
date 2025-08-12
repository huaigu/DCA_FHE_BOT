'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWalletStore, useDCAStore } from '@/lib/store'
import { encryptDCAIntent, type EncryptedIntent } from '@/utils/fheEncryption'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Loader2, Shield, DollarSign, Clock, TrendingUp } from 'lucide-react'

interface DCAFormData {
  budget: string
  tradesCount: string
  amountPerTrade: string
  frequency: string
  minPrice: string
  maxPrice: string
}

export function DCAForm() {
  const { isConnected, address, provider } = useWalletStore()
  const { isSubmitting, submitIntent, error, clearError } = useDCAStore()
  
  const [formData, setFormData] = useState<DCAFormData>({
    budget: '',
    tradesCount: '',
    amountPerTrade: '',
    frequency: '',
    minPrice: '',
    maxPrice: '',
  })

  const [isEncrypting, setIsEncrypting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleInputChange = (field: keyof DCAFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Auto-calculate amount per trade based on budget and trades count
    if (field === 'budget' || field === 'tradesCount') {
      const budget = field === 'budget' ? parseFloat(value) : parseFloat(formData.budget)
      const trades = field === 'tradesCount' ? parseInt(value) : parseInt(formData.tradesCount)
      
      if (budget && trades && trades > 0) {
        const amountPerTrade = (budget / trades).toFixed(2)
        setFormData(prev => ({ ...prev, amountPerTrade }))
      }
    }
  }

  const validateForm = (): string | null => {
    const { budget, tradesCount, amountPerTrade, frequency, minPrice, maxPrice } = formData

    if (!budget || parseFloat(budget) <= 0) return 'Budget must be greater than 0'
    if (!tradesCount || parseInt(tradesCount) <= 0) return 'Number of trades must be greater than 0'
    if (!amountPerTrade || parseFloat(amountPerTrade) <= 0) return 'Amount per trade must be greater than 0'
    if (!frequency || parseInt(frequency) <= 0) return 'Frequency must be greater than 0'
    if (!minPrice || parseFloat(minPrice) <= 0) return 'Minimum price must be greater than 0'
    if (!maxPrice || parseFloat(maxPrice) <= 0) return 'Maximum price must be greater than 0'
    if (parseFloat(minPrice) >= parseFloat(maxPrice)) return 'Minimum price must be less than maximum price'

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected || !provider || !address) {
      alert('Please connect your wallet first')
      return
    }

    const validationError = validateForm()
    if (validationError) {
      alert(validationError)
      return
    }

    try {
      setIsEncrypting(true)
      clearError()

      // Convert form data to encrypted intent
      const intent: EncryptedIntent = {
        budget: BigInt(Math.floor(parseFloat(formData.budget) * 1e6)), // Convert to USDC units
        tradesCount: parseInt(formData.tradesCount),
        amountPerTrade: BigInt(Math.floor(parseFloat(formData.amountPerTrade) * 1e6)),
        frequency: parseInt(formData.frequency),
        minPrice: BigInt(Math.floor(parseFloat(formData.minPrice) * 1e8)), // Price in cents
        maxPrice: BigInt(Math.floor(parseFloat(formData.maxPrice) * 1e8)),
      }

      // Encrypt the intent (this would use the contract address in a real implementation)
      const contractAddress = '0x' + '0'.repeat(40) // Placeholder
      const encryptedProof = await encryptDCAIntent(intent, contractAddress, address)

      // Submit to smart contract
      await submitIntent({
        ...intent,
        encryptedProof,
        userAddress: address,
      })

      // Reset form on success
      setFormData({
        budget: '',
        tradesCount: '',
        amountPerTrade: '',
        frequency: '',
        minPrice: '',
        maxPrice: '',
      })

      alert('DCA intent submitted successfully!')
    } catch (error) {
      console.error('Failed to submit DCA intent:', error)
      alert('Failed to submit DCA intent. Please try again.')
    } finally {
      setIsEncrypting(false)
    }
  }

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
                  value={formData.budget}
                  onChange={(e) => handleInputChange('budget', e.target.value)}
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
                  Automatically calculated: {formData.budget && formData.tradesCount ? 
                    formatCurrency(parseFloat(formData.budget) / parseInt(formData.tradesCount)) : 
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

            {/* Error Display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <p className="text-sm text-red-800">{error}</p>
              </motion.div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isEncrypting}
              size="lg"
            >
              {isEncrypting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Encrypting Intent...
                </>
              ) : isSubmitting ? (
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

            <div className="text-center text-xs text-muted-foreground">
              <p>
                Your intent will be encrypted and added to the next batch.
                Execution depends on batch size (10 users) and your price conditions.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}