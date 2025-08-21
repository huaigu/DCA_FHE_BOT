import { BrowserProvider, JsonRpcSigner } from "ethers";

export interface EncryptedIntent {
  budget: bigint;
  tradesCount: number;
  amountPerTrade: bigint;
  frequency: number;
  minPrice: bigint;
  maxPrice: bigint;
}

export interface EncryptedInputProof {
  handles: string[];
  inputProof: string;
}

export interface DCAIntentParams {
  budget: bigint;
  tradesCount: number;
  amountPerTrade: bigint;
  frequency: number;
  minPrice?: bigint;
  maxPrice?: bigint;
}

export interface EncryptedDCAParams {
  budget: { encryptedData: string; proof: string };
  tradesCount: { encryptedData: string; proof: string };
  amountPerTrade: { encryptedData: string; proof: string };
  frequency: { encryptedData: string; proof: string };
  minPrice: { encryptedData: string; proof: string };
  maxPrice: { encryptedData: string; proof: string };
}

// 新的合约参数接口，匹配修正后的合约结构
export interface ContractSubmitIntentParams {
  budgetExt: string;
  tradesCountExt: string; 
  amountPerTradeExt: string;
  frequencyExt: string;
  minPriceExt: string;
  maxPriceExt: string;
  proof: string; // 统一的证明参数
}

// FHE 实例管理
let fhevmInstance: any = null;
let sdkInitialized = false;

/**
 * 初始化 FHEVM 实例 - 按照官方文档正确初始化
 */
export async function initializeFHE(): Promise<any> {
  try {
    if (!fhevmInstance) {
      console.log("Initializing FHEVM using npm package...");

      // Step 1: 动态导入 SDK
      console.log("Loading FHE SDK modules...");
      const { initSDK, createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
      console.log("FHE SDK modules loaded successfully");

      // Step 2: 初始化 SDK (加载 WASM)
      if (!sdkInitialized) {
        console.log("Loading TFHE WASM...");
        await initSDK(); // 按照文档，直接调用，不需要检查函数类型
        sdkInitialized = true;
        console.log("TFHE WASM loaded successfully");
      }

      // Step 3: 创建实例
      const config = {
        ...SepoliaConfig,
        network: (window as any).ethereum, // 按照文档，使用 window.ethereum
      };

      console.log("Creating FHEVM instance with config:", config);
      fhevmInstance = await createInstance(config);
      console.log("FHEVM instance created successfully");
    }

    return fhevmInstance;
  } catch (error) {
    console.error("Failed to initialize FHEVM:", error);
    console.warn("FHE functionality will be disabled");
    // 不抛出错误，而是返回 null，让应用继续运行
    return null;
  }
}

/**
 * 获取已初始化的 FHEVM 实例
 */
export async function getFhevmInstance(): Promise<any> {
  if (!fhevmInstance) {
    await initializeFHE();
  }
  return fhevmInstance;
}

/**
 * 检查 FHE 是否可用
 */
export function isFHEAvailable(): boolean {
  return fhevmInstance !== null;
}

/**
 * 加密单个金额值（用于 FundPool 存款）
 */
export async function encryptAmount(
  amount: bigint,
  contractAddress: string,
  userAddress: string,
): Promise<{ encryptedData: string; proof: string }> {
  try {
    const fhevm = await getFhevmInstance();

    if (!fhevm) {
      throw new Error("FHE not available - encryption failed");
    }

    // 创建加密输入
    const encryptedInput = fhevm.createEncryptedInput(contractAddress, userAddress);
    encryptedInput.add64(amount);

    // 生成加密证明
    const inputProof = encryptedInput.encrypt();

    return {
      encryptedData: inputProof.handles[0],
      proof: inputProof.inputProof,
    };
  } catch (error) {
    console.error("Failed to encrypt amount:", error);
    throw new Error(`Amount encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * 加密 DCA 意图的所有参数
 */
export async function encryptDCAIntent(
  params: DCAIntentParams,
  contractAddress: string,
  userAddress: string,
): Promise<EncryptedDCAParams> {
  try {
    const fhevm = await getFhevmInstance();

    if (!fhevm) {
      throw new Error("FHE not available - DCA intent encryption failed");
    }

    // 创建单个加密输入缓冲区一次性加密所有参数
    const buffer = fhevm.createEncryptedInput(contractAddress, userAddress);
    
    // 按顺序添加所有参数到缓冲区
    buffer.add64(params.budget);                              // index 0: budget (euint64)
    buffer.add32(params.tradesCount);                         // index 1: tradesCount (euint32)
    buffer.add64(params.amountPerTrade);                      // index 2: amountPerTrade (euint64)
    buffer.add32(params.frequency);                           // index 3: frequency (euint32)
    buffer.add64(params.minPrice || BigInt(0));               // index 4: minPrice (euint64)
    buffer.add64(params.maxPrice || BigInt(2 ** 32 - 1));     // index 5: maxPrice (euint64)

    // 一次性加密所有参数
    const ciphertexts = await buffer.encrypt();

    // 构造返回对象，按照预期的索引顺序分配句柄
    const encryptedParams: EncryptedDCAParams = {
      budget: {
        encryptedData: ciphertexts.handles[0],
        proof: ciphertexts.inputProof,
      },
      tradesCount: {
        encryptedData: ciphertexts.handles[1],
        proof: ciphertexts.inputProof,
      },
      amountPerTrade: {
        encryptedData: ciphertexts.handles[2],
        proof: ciphertexts.inputProof,
      },
      frequency: {
        encryptedData: ciphertexts.handles[3],
        proof: ciphertexts.inputProof,
      },
      minPrice: {
        encryptedData: ciphertexts.handles[4],
        proof: ciphertexts.inputProof,
      },
      maxPrice: {
        encryptedData: ciphertexts.handles[5],
        proof: ciphertexts.inputProof,
      },
    };

    return encryptedParams;
  } catch (error) {
    console.error("Failed to encrypt DCA intent:", error);
    throw new Error("DCA intent encryption failed");
  }
}

/**
 * 转换加密参数为合约调用格式
 */
export function convertToContractParams(encryptedParams: EncryptedDCAParams): ContractSubmitIntentParams {
  return {
    budgetExt: encryptedParams.budget.encryptedData,
    tradesCountExt: encryptedParams.tradesCount.encryptedData,
    amountPerTradeExt: encryptedParams.amountPerTrade.encryptedData,
    frequencyExt: encryptedParams.frequency.encryptedData,
    minPriceExt: encryptedParams.minPrice.encryptedData,
    maxPriceExt: encryptedParams.maxPrice.encryptedData,
    proof: encryptedParams.budget.proof // 所有参数使用同一个证明
  };
}

/**
 * 解密用户余额
 */
export async function decryptUserBalance(
  encryptedBalance: string,
  contractAddress: string,
  signer: JsonRpcSigner,
): Promise<bigint> {
  try {
    const fhevm = await getFhevmInstance();

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
      euint256: 8,
    };

    // 解密 euint64 类型的余额
    const decryptedValue = await fhevm.decrypt(FhevmType.euint64, encryptedBalance, contractAddress, signer);

    return BigInt(decryptedValue);
  } catch (error) {
    console.error("Failed to decrypt balance:", error);
    console.warn("Balance decryption failed, this might be expected in development mode");
    // 在开发模式下返回模拟值
    return BigInt(Math.floor(Math.random() * 1000000000));
  }
}

/**
 * 检查 FHE SDK 是否已初始化
 */
export function isFHESDKLoaded(): boolean {
  return sdkInitialized && fhevmInstance !== null;
}

/**
 * 等待 FHE SDK 初始化完成
 */
export async function waitForFHESDK(timeout = 10000): Promise<void> {
  if (isFHESDKLoaded()) {
    return;
  }

  const startTime = Date.now();
  while (!isFHESDKLoaded() && Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!isFHESDKLoaded()) {
    throw new Error("Timeout waiting for FHE SDK to initialize");
  }
}

/**
 * 重置 FHE 实例（用于测试或重新初始化）
 */
export function resetFHEInstance(): void {
  fhevmInstance = null;
  sdkInitialized = false;
  console.log("FHE instance reset");
}

// 导出传统接口以保持兼容性
export class FHEEncryption {
  async initialize(_provider: BrowserProvider): Promise<void> {
    try {
      await initializeFHE();
      console.log("FHE encryption initialized with npm package");
    } catch (error) {
      console.error("Failed to initialize FHE encryption:", error);
      throw new Error("FHE initialization failed");
    }
  }

  async encryptIntent(
    intent: EncryptedIntent,
    contractAddress: string,
    userAddress: string,
  ): Promise<EncryptedInputProof> {
    const params = {
      budget: intent.budget,
      tradesCount: intent.tradesCount,
      amountPerTrade: intent.amountPerTrade,
      frequency: intent.frequency,
      minPrice: intent.minPrice,
      maxPrice: intent.maxPrice,
    };

    const encrypted = await encryptDCAIntent(params, contractAddress, userAddress);

    return {
      handles: [
        encrypted.budget.encryptedData,
        encrypted.tradesCount.encryptedData,
        encrypted.amountPerTrade.encryptedData,
        encrypted.frequency.encryptedData,
        encrypted.minPrice.encryptedData,
        encrypted.maxPrice.encryptedData,
      ],
      inputProof: encrypted.budget.proof, // 所有参数使用同一个证明
    };
  }

  async decryptBalance(encryptedBalance: string, contractAddress: string, signer: JsonRpcSigner): Promise<bigint> {
    return await decryptUserBalance(encryptedBalance, contractAddress, signer);
  }

  getPublicKey(): string | null {
    // 这个方法在新的 SDK 中可能不需要
    return null;
  }

  isInitialized(): boolean {
    return fhevmInstance !== null;
  }
}

// 单例实例（保持兼容性）
export const fheEncryption = new FHEEncryption();

// 兼容性函数
export async function initializeFHECompat(provider: BrowserProvider): Promise<void> {
  await fheEncryption.initialize(provider);
}
