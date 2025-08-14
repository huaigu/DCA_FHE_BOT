// Contract addresses and configuration for Sepolia testnet
export const SEPOLIA_CONTRACTS = {
  // Main DCA system contracts (to be deployed)
  FUND_POOL: process.env.NEXT_PUBLIC_FUND_POOL_ADDRESS || '',
  INTENT_COLLECTOR: process.env.NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS || '',
  CONFIDENTIAL_TOKEN: process.env.NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ADDRESS || '',
  BATCH_PROCESSOR: process.env.NEXT_PUBLIC_BATCH_PROCESSOR_ADDRESS || '',
  
  // External tokens on Sepolia
  WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
  USDC: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
  
  // Uniswap V2 Router on Sepolia
  UNISWAP_ROUTER: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008',
} as const;

// Network configuration
export const SEPOLIA_CONFIG = {
  chainId: 11155111,
  name: 'Sepolia',
  rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_API_KEY',
  blockExplorer: 'https://sepolia.etherscan.io',
} as const;

// Token metadata
export const TOKEN_METADATA = {
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    address: SEPOLIA_CONTRACTS.USDC,
  },
  WETH: {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
    address: SEPOLIA_CONTRACTS.WETH,
  },
} as const;

// DCA configuration
export const DCA_CONFIG = {
  // Batch settings
  MIN_BATCH_SIZE: 5,
  MAX_BATCH_SIZE: 10,
  BATCH_TIMEOUT: 300, // 5 minutes
  
  // Trading settings
  MIN_TRADE_AMOUNT: 1e6, // 1 USDC (6 decimals)
  MAX_TRADE_AMOUNT: 1000e6, // 1000 USDC
  MIN_TRADES_COUNT: 1,
  MAX_TRADES_COUNT: 100,
  
  // Frequency options (in seconds)
  FREQUENCIES: {
    '1 minute': 60,
    '5 minutes': 300,
    '15 minutes': 900,
    '1 hour': 3600,
    '6 hours': 21600,
    '12 hours': 43200,
    '1 day': 86400,
    '3 days': 259200,
    '1 week': 604800,
  },
  
  // Price range settings (basis points for percentage)
  MIN_PRICE_RANGE: 100, // 1%
  MAX_PRICE_RANGE: 5000, // 50%
} as const;

// Uniswap V2 swap path for USDC → WETH
export const SWAP_PATH = [SEPOLIA_CONTRACTS.USDC, SEPOLIA_CONTRACTS.WETH] as const;

// Contract validation helper
export function validateContractAddresses(): boolean {
  const requiredContracts = [
    'FUND_POOL',
    'INTENT_COLLECTOR', 
    'CONFIDENTIAL_TOKEN',
    'BATCH_PROCESSOR'
  ] as const;
  
  return requiredContracts.every(contract => 
    SEPOLIA_CONTRACTS[contract] && 
    SEPOLIA_CONTRACTS[contract] !== ''
  );
}

// Environment validation
export function validateEnvironment(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!validateContractAddresses()) {
    errors.push('DCA contract addresses not configured');
  }
  
  if (!SEPOLIA_CONFIG.rpcUrl || SEPOLIA_CONFIG.rpcUrl.includes('YOUR_API_KEY')) {
    errors.push('Sepolia RPC URL not configured');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}