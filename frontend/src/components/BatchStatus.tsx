'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useIntentCollector } from '@/hooks/useIntentCollector'
import { DCA_CONFIG } from '@/config/contracts'
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

type BatchStatus = 'waiting' | 'collecting' | 'ready' | 'processing' | 'processed' | 'failed'

export function BatchStatus() {
  const {
    currentBatchStatus,
    batchStats,
    userIntentIds,
    refetchBatchStatus,
    refetchBatchStats,
    isLoading
  } = useIntentCollector()
  
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
      await Promise.all([
        refetchBatchStatus(),
        refetchBatchStats()
      ])
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

  const getTimeRemaining = () => {
    const timeRemaining = Number(batchStats.timeRemaining)
    
    if (timeRemaining === 0) return 'Timeout reached'
    
    const minutes = Math.floor(timeRemaining / 60)
    const seconds = timeRemaining % 60
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = () => {
    const pendingCount = Number(batchStats.pendingCount)
    const timeRemaining = Number(batchStats.timeRemaining)
    
    // Size progress (0-50%)
    const sizeProgress = Math.min((pendingCount / DCA_CONFIG.MAX_BATCH_SIZE) * 50, 50)
    
    // Time progress (0-50%)
    const timeElapsed = DCA_CONFIG.BATCH_TIMEOUT - timeRemaining
    const timeProgress = Math.min((timeElapsed / DCA_CONFIG.BATCH_TIMEOUT) * 50, 50)
    
    return Math.min(sizeProgress + timeProgress, 100)
  }

  // Current batch info
  const currentBatchId = Number(batchStats.currentBatch)
  const pendingCount = Number(batchStats.pendingCount)
  const timeRemaining = Number(batchStats.timeRemaining)
  const isReady = currentBatchStatus.isReady
  const userIntentsInBatch = userIntentIds.length
  
  // Determine batch status
  const batchStatus = isReady ? 'ready' : 
    pendingCount >= DCA_CONFIG.MIN_BATCH_SIZE ? 'collecting' : 
    'waiting'
    
  // Format time remaining
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return 'Expired'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* Current Batch Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className={`${getStatusColor(batchStatus)} border-2`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(batchStatus)}
                Current Batch #{currentBatchId}
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
              {batchStatus === 'waiting'
                ? 'Waiting for more intents to join the batch'
                : batchStatus === 'collecting' 
                ? 'Collecting encrypted intents for batch execution'
                : batchStatus === 'ready'
                ? 'Batch ready for processing'
                : 'Batch processing in progress'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(getProgressPercentage())}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className="bg-blue-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgressPercentage()}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Batch Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {pendingCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  of {DCA_CONFIG.MAX_BATCH_SIZE} intents
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {userIntentsInBatch}
                </div>
                <div className="text-xs text-muted-foreground">
                  your intents
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-xs text-muted-foreground">
                  time remaining
                </div>
              </div>

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
                {batchStatus === 'waiting' && (
                  <>
                    <Users className="w-4 h-4 inline mr-2" />
                    Waiting for at least {DCA_CONFIG.MIN_BATCH_SIZE} intents to start batch processing.
                  </>
                )}
                {batchStatus === 'collecting' && (
                  <>
                    <Clock className="w-4 h-4 inline mr-2" />
                    Batch will execute when {DCA_CONFIG.MAX_BATCH_SIZE} intents are collected 
                    or timeout is reached. Your intent parameters remain encrypted.
                  </>
                )}
                {batchStatus === 'ready' && (
                  <>
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Batch is ready for processing with FHE price filtering and aggregation.
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
            {userIntentIds.length > 0 ? (
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="font-medium">Your Active Intents</div>
                      <div className="text-sm text-muted-foreground">
                        {userIntentIds.length} encrypted DCA {userIntentIds.length === 1 ? 'intent' : 'intents'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">
                      {userIntentIds.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      active
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-800 text-center">
                <div className="text-muted-foreground">
                  No active DCA intents. Create your first encrypted strategy above.
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground text-center mt-4">
              <p>
                Batch history will be available after contract deployment.
                All intents use privacy-preserving FHE encryption.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}