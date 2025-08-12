'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDCAStore } from '@/lib/store'
import { formatNumber } from '@/lib/utils'
import { 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  TrendingUp,
  Shield,
  Activity
} from 'lucide-react'

interface Batch {
  id: number
  size: number
  status: 'collecting' | 'processing' | 'processed' | 'failed'
  timestamp: number
  totalAmount?: number
  priceAtExecution?: number
  participantCount?: number
}

const BATCH_TARGET_SIZE = 10
const BATCH_TIMEOUT = 5 * 60 * 1000 // 5 minutes

export function BatchStatus() {
  const { batches, currentBatch, refreshBatches, setCurrentBatch } = useDCAStore()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Update current time every second for real-time countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Auto-refresh batches every 30 seconds
  useEffect(() => {
    const autoRefresh = setInterval(() => {
      handleRefresh()
    }, 30000)

    // Initial load
    handleRefresh()

    return () => clearInterval(autoRefresh)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshBatches()
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStatusIcon = (status: Batch['status']) => {
    switch (status) {
      case 'collecting':
        return <Users className="w-4 h-4 text-blue-500" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
      case 'processed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Activity className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: Batch['status']) => {
    switch (status) {
      case 'collecting':
        return 'border-blue-200 bg-blue-50'
      case 'processing':
        return 'border-yellow-200 bg-yellow-50'
      case 'processed':
        return 'border-green-200 bg-green-50'
      case 'failed':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const getTimeRemaining = (batch: Batch) => {
    if (batch.status !== 'collecting') return null
    
    const elapsed = currentTime - batch.timestamp
    const remaining = Math.max(0, BATCH_TIMEOUT - elapsed)
    
    if (remaining === 0) return 'Timeout reached'
    
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = (batch: Batch) => {
    if (batch.status === 'collecting') {
      const sizeProgress = (batch.size / BATCH_TARGET_SIZE) * 50
      const elapsed = currentTime - batch.timestamp
      const timeProgress = Math.min((elapsed / BATCH_TIMEOUT) * 50, 50)
      return Math.min(sizeProgress + timeProgress, 100)
    }
    return batch.status === 'processed' ? 100 : 75
  }

  // Mock data for demo - in real app this would come from smart contract
  const mockCurrentBatch: Batch = {
    id: Date.now(),
    size: 7,
    status: 'collecting',
    timestamp: Date.now() - 120000, // 2 minutes ago
    participantCount: 7,
  }

  const mockRecentBatches: Batch[] = [
    {
      id: 1,
      size: 10,
      status: 'processed',
      timestamp: Date.now() - 1800000, // 30 minutes ago
      totalAmount: 15420,
      priceAtExecution: 1875.50,
      participantCount: 10,
    },
    {
      id: 2,
      size: 8,
      status: 'failed',
      timestamp: Date.now() - 3600000, // 1 hour ago
      participantCount: 8,
    },
    {
      id: 3,
      size: 10,
      status: 'processed',
      timestamp: Date.now() - 5400000, // 1.5 hours ago
      totalAmount: 23150,
      priceAtExecution: 1920.75,
      participantCount: 10,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Current Batch Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className={`${getStatusColor(mockCurrentBatch.status)} border-2`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(mockCurrentBatch.status)}
                Current Batch #{mockCurrentBatch.id}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <CardDescription>
              {mockCurrentBatch.status === 'collecting' 
                ? 'Collecting encrypted intents for batch execution'
                : 'Batch processing in progress'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{formatNumber(getProgressPercentage(mockCurrentBatch))}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className="bg-blue-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgressPercentage(mockCurrentBatch)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Batch Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {mockCurrentBatch.size}
                </div>
                <div className="text-xs text-muted-foreground">
                  of {BATCH_TARGET_SIZE} intents
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {mockCurrentBatch.participantCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  participants
                </div>
              </div>

              {mockCurrentBatch.status === 'collecting' && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {getTimeRemaining(mockCurrentBatch) || '--'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    time remaining
                  </div>
                </div>
              )}

              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  <Shield className="w-6 h-6 mx-auto" />
                </div>
                <div className="text-xs text-muted-foreground">
                  encrypted
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className="p-3 rounded-lg bg-white/50 border">
              <p className="text-sm">
                {mockCurrentBatch.status === 'collecting' && (
                  <>
                    <Clock className="w-4 h-4 inline mr-2" />
                    Batch will execute when {BATCH_TARGET_SIZE} intents are collected 
                    or timeout is reached. Your intent parameters remain encrypted.
                  </>
                )}
                {mockCurrentBatch.status === 'processing' && (
                  <>
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                    Processing batch with FHE price filtering and aggregation...
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Batches History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Batches
          </CardTitle>
          <CardDescription>
            History of batch executions and their outcomes
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            <AnimatePresence>
              {mockRecentBatches.map((batch) => (
                <motion.div
                  key={batch.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className={`p-4 rounded-lg border ${getStatusColor(batch.status)} cursor-pointer hover:shadow-md transition-shadow`}
                  onClick={() => setCurrentBatch(batch)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(batch.status)}
                      <div>
                        <div className="font-medium">Batch #{batch.id}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(batch.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-medium">
                        {batch.participantCount} participants
                      </div>
                      {batch.totalAmount && (
                        <div className="text-sm text-muted-foreground">
                          ${formatNumber(batch.totalAmount)} USDC
                        </div>
                      )}
                      {batch.priceAtExecution && (
                        <div className="text-sm text-green-600">
                          ETH: ${formatNumber(batch.priceAtExecution)}
                        </div>
                      )}
                    </div>
                  </div>

                  {batch.status === 'processed' && batch.totalAmount && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-medium">${formatNumber(batch.totalAmount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Price: </span>
                          <span className="font-medium">${formatNumber(batch.priceAtExecution!)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">ETH: </span>
                          <span className="font-medium">
                            {formatNumber(batch.totalAmount / batch.priceAtExecution!, 3)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}