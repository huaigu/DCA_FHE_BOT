import { create } from 'zustand'
import { BrowserProvider, JsonRpcSigner } from 'ethers'
import { SEPOLIA_CONFIG } from '@/config/contracts'

interface WalletState {
  isConnected: boolean
  address: string | null
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  chainId: number | null
  isConnecting: boolean
  error: string | null
  isNetworkSwitching: boolean
}

interface WalletActions {
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  switchToSepolia: () => Promise<void>
  clearError: () => void
  handleNetworkChange: (chainId: string) => void
  initializeNetworkListeners: () => void
  removeNetworkListeners: () => void
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
  isNetworkSwitching: false,

  // Network event handlers
  handleNetworkChange: (chainId: string) => {
    const newChainId = parseInt(chainId, 16)
    console.log('Network changed to:', newChainId)
    
    if (newChainId !== SEPOLIA_CONFIG.chainId) {
      set({ 
        error: `Please switch to Sepolia testnet (Chain ID: ${SEPOLIA_CONFIG.chainId})`,
        chainId: newChainId
      })
    } else {
      set({ 
        error: null,
        chainId: newChainId
      })
    }
  },

  initializeNetworkListeners: () => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('chainChanged', get().handleNetworkChange)
    }
  },

  removeNetworkListeners: () => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.removeListener('chainChanged', get().handleNetworkChange)
    }
  },

  // Actions
  switchToSepolia: async () => {
    try {
      set({ isNetworkSwitching: true })
      
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed')
      }

      // Try to switch to Sepolia
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${SEPOLIA_CONFIG.chainId.toString(16)}` }],
        })
      } catch (switchError: any) {
        // If the chain doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${SEPOLIA_CONFIG.chainId.toString(16)}`,
                chainName: SEPOLIA_CONFIG.name,
                rpcUrls: [SEPOLIA_CONFIG.rpcUrl],
                blockExplorerUrls: [SEPOLIA_CONFIG.blockExplorer],
                nativeCurrency: {
                  name: 'Sepolia ETH',
                  symbol: 'SepoliaETH',
                  decimals: 18,
                },
              },
            ],
          })
        } else {
          throw switchError
        }
      }
      
      set({ isNetworkSwitching: false })
    } catch (error) {
      set({ isNetworkSwitching: false })
      throw new Error(error instanceof Error ? error.message : 'Failed to switch to Sepolia')
    }
  },

  connectWallet: async () => {
    try {
      set({ isConnecting: true, error: null })

      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed')
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      // Create initial provider and check network
      let provider = new BrowserProvider(window.ethereum)
      let network = await provider.getNetwork()
      let chainId = Number(network.chainId)

      // If not on Sepolia, switch networks and recreate provider
      if (chainId !== SEPOLIA_CONFIG.chainId) {
        console.log(`Current chain: ${chainId}, switching to Sepolia (${SEPOLIA_CONFIG.chainId})...`)
        await get().switchToSepolia()
        
        // Wait a bit for network switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Recreate provider after network switch
        provider = new BrowserProvider(window.ethereum)
        network = await provider.getNetwork()
        chainId = Number(network.chainId)
        
        if (chainId !== SEPOLIA_CONFIG.chainId) {
          throw new Error('Failed to switch to Sepolia testnet')
        }
      }

      // Get signer and address after confirming correct network
      const signer = await provider.getSigner()
      const address = await signer.getAddress()

      // Initialize network listeners
      get().initializeNetworkListeners()

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
    // Remove network listeners
    get().removeNetworkListeners()
    
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