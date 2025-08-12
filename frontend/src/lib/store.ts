import { create } from 'zustand'
import { BrowserProvider, JsonRpcSigner } from 'ethers'

interface WalletState {
  isConnected: boolean
  address: string | null
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  chainId: number | null
  isConnecting: boolean
  error: string | null
}

interface WalletActions {
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  clearError: () => void
}

interface DCAState {
  intents: any[]
  batches: any[]
  currentBatch: any | null
  isSubmitting: boolean
  isProcessing: boolean
  error: string | null
}

interface DCAActions {
  submitIntent: (intent: any) => Promise<void>
  refreshBatches: () => Promise<void>
  setCurrentBatch: (batch: any) => void
  clearError: () => void
}

export const useWalletStore = create<WalletState & WalletActions>((set, get) => ({
  // State
  isConnected: false,
  address: null,
  provider: null,
  signer: null,
  chainId: null,
  isConnecting: false,
  error: null,

  // Actions
  connectWallet: async () => {
    try {
      set({ isConnecting: true, error: null })

      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed')
      }

      const provider = new BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)

      // Check if on Sepolia testnet
      if (chainId !== 11155111) {
        throw new Error('Please switch to Sepolia testnet')
      }

      set({
        isConnected: true,
        address,
        provider,
        signer,
        chainId,
        isConnecting: false,
        error: null,
      })
    } catch (error) {
      set({
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      })
    }
  },

  disconnectWallet: () => {
    set({
      isConnected: false,
      address: null,
      provider: null,
      signer: null,
      chainId: null,
      error: null,
    })
  },

  clearError: () => {
    set({ error: null })
  },
}))

export const useDCAStore = create<DCAState & DCAActions>((set, get) => ({
  // State
  intents: [],
  batches: [],
  currentBatch: null,
  isSubmitting: false,
  isProcessing: false,
  error: null,

  // Actions
  submitIntent: async (intent: any) => {
    try {
      set({ isSubmitting: true, error: null })
      
      // Here you would interact with the smart contract
      // For now, just simulate the submission
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      set({ isSubmitting: false })
    } catch (error) {
      set({
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Submission failed',
      })
    }
  },

  refreshBatches: async () => {
    try {
      // Here you would fetch batch data from the smart contract
      // For now, just simulate the fetch
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockBatches = [
        {
          id: 1,
          size: 8,
          status: 'collecting',
          timestamp: Date.now() - 300000,
        },
        {
          id: 2,
          size: 10,
          status: 'processed',
          timestamp: Date.now() - 600000,
        },
      ]
      
      set({ batches: mockBatches })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch batches',
      })
    }
  },

  setCurrentBatch: (batch: any) => {
    set({ currentBatch: batch })
  },

  clearError: () => {
    set({ error: null })
  },
}))