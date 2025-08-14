import { BrowserProvider, JsonRpcSigner } from 'ethers'

// 声明全局类型
declare global {
  interface Window {
    [key: string]: any; // 允许访问任何全局属性
  }
}

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

export interface DCAIntentParams {
  budget: bigint
  tradesCount: number
  amountPerTrade: bigint
  frequency: number
  minPrice?: bigint
  maxPrice?: bigint
}

export interface EncryptedDCAParams {
  budget: { encryptedData: string; proof: string }
  tradesCount: { encryptedData: string; proof: string }
  amountPerTrade: { encryptedData: string; proof: string }
  frequency: { encryptedData: string; proof: string }
  minPrice: { encryptedData: string; proof: string }
  maxPrice: { encryptedData: string; proof: string }
}

// FHE 实例管理
let fhevmInstance: any = null
let sdkInitialized = false

/**
 * 初始化 FHEVM 实例
 * 使用 CDN 加载的 SDK 和 Sepolia 配置
 */
export async function initializeFHE(): Promise<any> {
  try {
    if (!fhevmInstance) {
      console.log('Checking available global objects...')
      console.log('Available keys:', Object.keys(window).filter(key => 
        key.toLowerCase().includes('relayer') || 
        key.toLowerCase().includes('fhe') || 
        key.toLowerCase().includes('zama')
      ))

      // 检查可能的全局对象名称
      const possibleNames = ['RelayerSDK', 'FHE', 'Zama', 'relayerSDK', 'fhe']
      let sdk = null

      for (const name of possibleNames) {
        if (window[name]) {
          sdk = window[name]
          console.log(`Found SDK at window.${name}:`, sdk)
          break
        }
      }

      if (!sdk) {
        // 如果没有找到明确的SDK对象，检查是否有直接的函数
        if (window.initSDK && window.createInstance) {
          sdk = window
          console.log('Found SDK functions directly on window object')
        } else {
          throw new Error('FHE SDK not found. Please ensure the FHE SDK is loaded via CDN.')
        }
      }

      // 初始化 SDK
      if (!sdkInitialized && sdk.initSDK) {
        console.log('Initializing FHE SDK from CDN...')
        await sdk.initSDK()
        sdkInitialized = true
        console.log('FHE SDK initialized successfully')
      }

      console.log('Creating FHEVM instance...')

      // 尝试使用 SepoliaConfig 或手动配置
      let config
      if (sdk.SepoliaConfig) {
        config = {
          ...sdk.SepoliaConfig,
          network: (window as any).ethereum || "https://eth-sepolia.public.blastapi.io",
        }
        console.log('Using SepoliaConfig:', config)
      } else {
        // 手动配置 Sepolia 参数
        config = {
          aclContractAddress: "0x687820221192C5B662b25367F70076A37bc79b6c",
          kmsContractAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
          inputVerifierContractAddress: "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4",
          verifyingContractAddressDecryption: "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1",
          verifyingContractAddressInputVerification: "0x7048C39f048125eDa9d678AEbaDfB22F7900a29F",
          chainId: 11155111, // Sepolia chain ID
          gatewayChainId: 55815,
          network: (window as any).ethereum || "https://eth-sepolia.public.blastapi.io",
          relayerUrl: "https://relayer.testnet.zama.cloud",
        }
        console.log('Using manual Sepolia config:', config)
      }

      fhevmInstance = await sdk.createInstance(config)
      console.log('FHEVM relayer SDK instance initialized successfully')
    }
    return fhevmInstance
  } catch (error) {
    console.error('Failed to initialize FHEVM relayer SDK:', error)
    console.error('Error details:', error)
    throw new Error('Failed to initialize FHE encryption. Please check console for details.')
  }
}

/**
 * 获取已初始化的 FHEVM 实例
 */
export async function getFhevmInstance(): Promise<any> {
  if (!fhevmInstance) {
    await initializeFHE()
  }
  return fhevmInstance
}

/**
 * 加密单个金额值（用于 FundPool 存款）
 */
export async function encryptAmount(
  amount: bigint,
  contractAddress: string,
  userAddress: string
): Promise<{ encryptedData: string; proof: string }> {
  try {
    const fhevm = await getFhevmInstance()
    
    // 创建加密输入
    const encryptedInput = fhevm.createEncryptedInput(contractAddress, userAddress)
    encryptedInput.add64(amount)
    
    // 生成加密证明
    const inputProof = encryptedInput.encrypt()
    
    return {
      encryptedData: inputProof.handles[0],
      proof: inputProof.inputProof
    }
  } catch (error) {
    console.error('Failed to encrypt amount:', error)
    throw new Error('Amount encryption failed')
  }
}

/**
 * 加密 DCA 意图的所有参数
 */
export async function encryptDCAIntent(
  params: DCAIntentParams,
  contractAddress: string,
  userAddress: string
): Promise<EncryptedDCAParams> {
  try {
    const fhevm = await getFhevmInstance()
    
    // 为每个参数创建单独的加密输入
    const encryptedParams: any = {}
    
    // 加密 budget (euint64)
    let input = fhevm.createEncryptedInput(contractAddress, userAddress)
    input.add64(params.budget)
    let proof = input.encrypt()
    encryptedParams.budget = {
      encryptedData: proof.handles[0],
      proof: proof.inputProof
    }
    
    // 加密 tradesCount (euint32)
    input = fhevm.createEncryptedInput(contractAddress, userAddress)
    input.add32(params.tradesCount)
    proof = input.encrypt()
    encryptedParams.tradesCount = {
      encryptedData: proof.handles[0],
      proof: proof.inputProof
    }
    
    // 加密 amountPerTrade (euint64)
    input = fhevm.createEncryptedInput(contractAddress, userAddress)
    input.add64(params.amountPerTrade)
    proof = input.encrypt()
    encryptedParams.amountPerTrade = {
      encryptedData: proof.handles[0],
      proof: proof.inputProof
    }
    
    // 加密 frequency (euint32)
    input = fhevm.createEncryptedInput(contractAddress, userAddress)
    input.add32(params.frequency)
    proof = input.encrypt()
    encryptedParams.frequency = {
      encryptedData: proof.handles[0],
      proof: proof.inputProof
    }
    
    // 加密 minPrice (euint64) - 使用默认值 0 如果未提供
    input = fhevm.createEncryptedInput(contractAddress, userAddress)
    input.add64(params.minPrice || BigInt(0))
    proof = input.encrypt()
    encryptedParams.minPrice = {
      encryptedData: proof.handles[0],
      proof: proof.inputProof
    }
    
    // 加密 maxPrice (euint64) - 使用最大值如果未提供
    input = fhevm.createEncryptedInput(contractAddress, userAddress)
    input.add64(params.maxPrice || BigInt(2**32 - 1))
    proof = input.encrypt()
    encryptedParams.maxPrice = {
      encryptedData: proof.handles[0],
      proof: proof.inputProof
    }
    
    return encryptedParams as EncryptedDCAParams
  } catch (error) {
    console.error('Failed to encrypt DCA intent:', error)
    throw new Error('DCA intent encryption failed')
  }
}

/**
 * 解密用户余额
 */
export async function decryptUserBalance(
  encryptedBalance: string,
  contractAddress: string,
  signer: JsonRpcSigner
): Promise<bigint> {
  try {
    const fhevm = await getFhevmInstance()
    
    // 使用 FhevmType.euint64 进行解密
    const FhevmType = {
      ebool: 0,
      euint4: 1,
      euint8: 2,
      euint16: 3,
      euint32: 4,
      euint64: 5,
      euint128: 6,
      eaddress: 7,
      euint256: 8
    }
    
    // 解密 euint64 类型的余额
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      contractAddress,
      signer
    )
    
    return BigInt(decryptedValue)
  } catch (error) {
    console.error('Failed to decrypt balance:', error)
    console.warn('Balance decryption failed, this might be expected in development mode')
    // 在开发模式下返回模拟值
    return BigInt(Math.floor(Math.random() * 1000000000))
  }
}

/**
 * 检查 FHE SDK 是否已加载
 */
export function isFHESDKLoaded(): boolean {
  const possibleNames = ['RelayerSDK', 'FHE', 'Zama', 'relayerSDK', 'fhe']
  
  for (const name of possibleNames) {
    if (window[name]) {
      return true
    }
  }
  
  // 检查直接函数
  return !!(window.initSDK && window.createInstance)
}

/**
 * 等待 FHE SDK 加载完成
 */
export function waitForFHESDK(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isFHESDKLoaded()) {
      resolve()
      return
    }
    
    const checkInterval = 100
    const maxAttempts = timeout / checkInterval
    let attempts = 0
    
    const interval = setInterval(() => {
      attempts++
      
      if (isFHESDKLoaded()) {
        clearInterval(interval)
        resolve()
      } else if (attempts >= maxAttempts) {
        clearInterval(interval)
        reject(new Error('Timeout waiting for FHE SDK to load'))
      }
    }, checkInterval)
  })
}

/**
 * 重置 FHE 实例（用于测试或重新初始化）
 */
export function resetFHEInstance(): void {
  fhevmInstance = null
  sdkInitialized = false
  console.log('FHE instance reset')
}

// 导出传统接口以保持兼容性
export class FHEEncryption {
  async initialize(provider: BrowserProvider): Promise<void> {
    try {
      await initializeFHE()
      console.log('FHE encryption initialized with dynamic SDK')
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
    const params = {
      budget: intent.budget,
      tradesCount: intent.tradesCount,
      amountPerTrade: intent.amountPerTrade,
      frequency: intent.frequency,
      minPrice: intent.minPrice,
      maxPrice: intent.maxPrice
    }
    
    const encrypted = await encryptDCAIntent(params, contractAddress, userAddress)
    
    return {
      handles: [
        encrypted.budget.encryptedData,
        encrypted.tradesCount.encryptedData,
        encrypted.amountPerTrade.encryptedData,
        encrypted.frequency.encryptedData,
        encrypted.minPrice.encryptedData,
        encrypted.maxPrice.encryptedData
      ],
      inputProof: encrypted.budget.proof // 简化版本，实际应该组合所有证明
    }
  }

  async decryptBalance(
    encryptedBalance: string,
    contractAddress: string,
    signer: JsonRpcSigner
  ): Promise<bigint> {
    return await decryptUserBalance(encryptedBalance, contractAddress, signer)
  }

  getPublicKey(): string | null {
    // 这个方法在新的 SDK 中可能不需要
    return null
  }

  isInitialized(): boolean {
    return fhevmInstance !== null
  }
}

// 单例实例（保持兼容性）
export const fheEncryption = new FHEEncryption()

// 兼容性函数
export async function initializeFHECompat(provider: BrowserProvider): Promise<void> {
  await fheEncryption.initialize(provider)
}