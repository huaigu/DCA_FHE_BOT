import { useEffect, useState } from 'react'
import { initializeFHE, isFHESDKLoaded } from '@/utils/fheEncryption'

export interface FHEStatus {
  isLoaded: boolean
  isError: boolean
  error: string | null
  isLoading: boolean
}

export function useFHE() {
  const [status, setStatus] = useState<FHEStatus>({
    isLoaded: false,
    isError: false,
    error: null,
    isLoading: false
  })

  const initFHE = async () => {
    if (status.isLoading || status.isLoaded) return
    
    setStatus(prev => ({ ...prev, isLoading: true, isError: false, error: null }))
    
    try {
      console.log('Initializing FHE SDK...')
      await initializeFHE()
      
      setStatus({
        isLoaded: true,
        isError: false,
        error: null,
        isLoading: false
      })
      
      console.log('FHE SDK initialized successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('FHE initialization failed:', errorMessage)
      
      setStatus({
        isLoaded: false,
        isError: true,
        error: errorMessage,
        isLoading: false
      })
    }
  }

  // Auto-initialize on mount
  useEffect(() => {
    // Only initialize if we're in the browser and not already loaded
    if (typeof window !== 'undefined' && !isFHESDKLoaded()) {
      void initFHE()
    } else if (isFHESDKLoaded()) {
      setStatus(prev => ({ ...prev, isLoaded: true }))
    }
  }, [initFHE])

  return {
    ...status,
    initFHE,
    retry: initFHE
  }
}