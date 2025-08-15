// Test environment configuration and contract addresses
import { SEPOLIA_CONTRACTS, SEPOLIA_CONFIG, validateContractAddresses, validateEnvironment } from './contracts';

console.log('🔧 DCA FHE Bot Frontend Configuration Test');
console.log('================================================');

console.log('\n📋 Contract Addresses:');
console.log('├── FundPool:', SEPOLIA_CONTRACTS.FUND_POOL);
console.log('├── IntentCollector:', SEPOLIA_CONTRACTS.INTENT_COLLECTOR);
console.log('├── ConfidentialToken:', SEPOLIA_CONTRACTS.CONFIDENTIAL_TOKEN);
console.log('├── BatchProcessor:', SEPOLIA_CONTRACTS.BATCH_PROCESSOR);
console.log('├── USDC:', SEPOLIA_CONTRACTS.USDC);
console.log('├── WETH:', SEPOLIA_CONTRACTS.WETH);
console.log('├── UniswapRouter:', SEPOLIA_CONTRACTS.UNISWAP_ROUTER);
console.log('└── PriceFeed:', SEPOLIA_CONTRACTS.PRICE_FEED);

console.log('\n🌐 Network Configuration:');
console.log('├── Chain ID:', SEPOLIA_CONFIG.chainId);
console.log('├── Name:', SEPOLIA_CONFIG.name);
console.log('├── RPC URL:', SEPOLIA_CONFIG.rpcUrl);
console.log('└── Explorer:', SEPOLIA_CONFIG.blockExplorer);

console.log('\n✅ Validation Results:');
console.log('├── Contract addresses valid:', validateContractAddresses());

const envValidation = validateEnvironment();
console.log('├── Environment valid:', envValidation.isValid);
if (!envValidation.isValid) {
  console.log('└── Errors:');
  envValidation.errors.forEach(error => console.log('    -', error));
}

export {};