import { FhevmInstance, getPublicKey, createInstance } from '@fhevm/fhevm'
import { BrowserProvider, JsonRpcSigner } from 'ethers'

export interface EncryptedIntent {
  budget: bigint
  tradesCount: number
  amountPerTrade: bigint
  frequency: number
  minPrice: bigint
  maxPrice: bigint
}

export interface EncryptedInputProof {
  handles: string[]
  inputProof: string
}

class FHEEncryption {
  private instance: FhevmInstance | null = null
  private publicKey: string | null = null

  async initialize(provider: BrowserProvider): Promise<void> {
    try {
      // Get chain ID
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)

      // Create FHE instance
      this.instance = await createInstance({
        chainId,
        publicKey: await getPublicKey(chainId),
      })

      this.publicKey = await getPublicKey(chainId)
    } catch (error) {
      console.error('Failed to initialize FHE encryption:', error)
      throw new Error('FHE initialization failed')
    }
  }

  async encryptIntent(
    intent: EncryptedIntent,
    contractAddress: string,
    userAddress: string
  ): Promise<EncryptedInputProof> {
    if (!this.instance) {
      throw new Error('FHE instance not initialized')
    }

    try {
      // Create encrypted input
      const encryptedInput = this.instance.createEncryptedInput(
        contractAddress,
        userAddress
      )

      // Add encrypted parameters
      encryptedInput.add64(intent.budget)
      encryptedInput.add32(intent.tradesCount)
      encryptedInput.add64(intent.amountPerTrade)
      encryptedInput.add32(intent.frequency)
      encryptedInput.add64(intent.minPrice)
      encryptedInput.add64(intent.maxPrice)

      // Generate proof
      const inputProof = encryptedInput.encrypt()

      return {
        handles: inputProof.handles,
        inputProof: inputProof.inputProof,
      }
    } catch (error) {
      console.error('Failed to encrypt intent:', error)
      throw new Error('Intent encryption failed')
    }
  }

  async decryptBalance(
    encryptedBalance: string,
    contractAddress: string,
    signer: JsonRpcSigner
  ): Promise<bigint> {
    if (!this.instance) {
      throw new Error('FHE instance not initialized')
    }

    try {
      // Decrypt the encrypted balance
      const decryptedValue = await this.instance.userDecryptEuint64(
        encryptedBalance,
        contractAddress,
        signer
      )

      return BigInt(decryptedValue)
    } catch (error) {
      console.error('Failed to decrypt balance:', error)
      throw new Error('Balance decryption failed')
    }
  }

  async encryptSingleValue(
    value: bigint,
    type: 'euint32' | 'euint64',
    contractAddress: string,
    userAddress: string
  ): Promise<string> {
    if (!this.instance) {
      throw new Error('FHE instance not initialized')
    }

    try {
      const encryptedInput = this.instance.createEncryptedInput(
        contractAddress,
        userAddress
      )

      if (type === 'euint32') {
        encryptedInput.add32(Number(value))
      } else {
        encryptedInput.add64(value)
      }

      const inputProof = encryptedInput.encrypt()
      return inputProof.handles[0]
    } catch (error) {
      console.error('Failed to encrypt value:', error)
      throw new Error('Value encryption failed')
    }
  }

  getPublicKey(): string | null {
    return this.publicKey
  }

  isInitialized(): boolean {
    return this.instance !== null
  }
}

// Singleton instance
export const fheEncryption = new FHEEncryption()

// Helper functions
export async function initializeFHE(provider: BrowserProvider): Promise<void> {
  await fheEncryption.initialize(provider)
}

export async function encryptDCAIntent(
  intent: EncryptedIntent,
  contractAddress: string,
  userAddress: string
): Promise<EncryptedInputProof> {
  return await fheEncryption.encryptIntent(intent, contractAddress, userAddress)
}

export async function decryptUserBalance(
  encryptedBalance: string,
  contractAddress: string,
  signer: JsonRpcSigner
): Promise<bigint> {
  return await fheEncryption.decryptBalance(
    encryptedBalance,
    contractAddress,
    signer
  )
}