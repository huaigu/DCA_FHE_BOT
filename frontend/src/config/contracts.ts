// Contract addresses and configuration for Sepolia testnet
export const SEPOLIA_CONTRACTS = {
  // Main DCA system contracts (deployed on Sepolia)
  FUND_POOL: process.env.NEXT_PUBLIC_FUND_POOL_ADDRESS || '0x79FE21399cC9a67a71E7F2f2DDEcF605F256fadd',
  INTENT_COLLECTOR: process.env.NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS || '0x768Dd3993b5Ce23B64De65Db678f843564cbeCd5',
  BATCH_PROCESSOR: process.env.NEXT_PUBLIC_BATCH_PROCESSOR_ADDRESS || '0xC64ebE49d825C36cF377f98cE6C8F7c8E06d9ea4',
  
  // External contracts on Sepolia  
  WETH: process.env.NEXT_PUBLIC_WETH_ADDRESS || '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  USDC: process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  
  // Uniswap V3 Router on Sepolia
  UNISWAP_ROUTER: process.env.NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS || '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
  
  // Chainlink Price Feed (ETH/USD) on Sepolia  
  PRICE_FEED: process.env.NEXT_PUBLIC_PRICE_FEED_ADDRESS || '0x694AA1769357215DE4FAC081bf1f309aDC325306',
} as const;

// Network configuration with multiple RPC fallbacks
export const SEPOLIA_CONFIG = {
  chainId: 11155111,
  name: 'Sepolia',
  rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/126e2978c6db47b7b116c07e4ba787e9',
  blockExplorer: 'https://sepolia.etherscan.io',
  // Fallback RPC URLs
  fallbackRpcs: [
    'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
    'https://sepolia.gateway.tenderly.co',
    'https://rpc.sepolia.org',
    'https://eth-sepolia.g.alchemy.com/v2/demo'
  ]
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