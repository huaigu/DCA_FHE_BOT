# DCA FHE Bot - Sepolia Deployment

## 📋 Contract Addresses

### Core DCA System Contracts

- **FundPool**: `0xfd782b3Ca5Ef7Ac8B403afA3227DC528228E42B8`
- **IntentCollector**: `0x9cf2477d9BB16a1a845D25b151F4d3383FbeA82E`
- **ConfidentialToken**: `0x3b6DE8eAea838Da47Eb42Cd5C38dfdC96eBE7BF7`
- **BatchProcessor**: `0x1283a47720607d239aE7d15E5F5991673E36a6BA`

### External Contracts (Sepolia)

- **USDC Token**: `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238`
- **WETH Token**: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`
- **Uniswap V3 Router**: `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`
- **Chainlink ETH/USD Price Feed**: `0x694AA1769357215DE4FAC081bf1f309aDC325306`

## 🌐 Network Information

- **Network**: Sepolia Testnet
- **Chain ID**: 11155111
- **RPC URL**: https://sepolia.infura.io/v3/126e2978c6db47b7b116c07e4ba787e9
- **Block Explorer**: https://sepolia.etherscan.io
- **Deployer**: `0xf8185A9E8DCABE43dcA52f2f649F51BE1E2E972a`
- **Deployment Date**: 2025-01-15

## 🔗 Etherscan Links

- [FundPool](https://sepolia.etherscan.io/address/0xfd782b3Ca5Ef7Ac8B403afA3227DC528228E42B8)
- [IntentCollector](https://sepolia.etherscan.io/address/0x9cf2477d9BB16a1a845D25b151F4d3383FbeA82E)
- [ConfidentialToken](https://sepolia.etherscan.io/address/0x3b6DE8eAea838Da47Eb42Cd5C38dfdC96eBE7BF7)
- [BatchProcessor](https://sepolia.etherscan.io/address/0x1283a47720607d239aE7d15E5F5991673E36a6BA)

## 📖 Usage Instructions

### 1. Frontend Environment Setup

The frontend `.env` file has been configured with all contract addresses:

```env
NEXT_PUBLIC_FUND_POOL_ADDRESS=0xfd782b3Ca5Ef7Ac8B403afA3227DC528228E42B8
NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS=0x9cf2477d9BB16a1a845D25b151F4d3383FbeA82E
NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ADDRESS=0x3b6DE8eAea838Da47Eb42Cd5C38dfdC96eBE7BF7
NEXT_PUBLIC_BATCH_PROCESSOR_ADDRESS=0x1283a47720607d239aE7d15E5F5991673E36a6BA
```

### 2. Contract Interaction (Backend)

```bash
# Check system status
npx hardhat task:system-info --network sepolia

# Check batch status
npx hardhat task:batch-status --network sepolia

# Submit a DCA intent
npx hardhat task:submit-intent --network sepolia --budget 500 --trades 10
```

### 3. Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## 🎯 System Features

- ✅ FHE-based privacy-preserving DCA strategies
- ✅ Batch processing for k-anonymity (5-10 users per batch)
- ✅ Encrypted price range conditions
- ✅ Chainlink price feeds integration
- ✅ Uniswap V3 DEX integration
- ✅ Automated batch triggering
- ✅ Encrypted token distribution

## 🔧 Configuration

- **Minimum Batch Size**: 5 intents
- **Maximum Batch Size**: 10 intents
- **Supported Trading Pair**: USDC → ETH
- **Price Feed**: ETH/USD (8 decimals)
- **FHE Types**: euint64 for amounts, euint32 for counts

## 🚀 Next Steps

1. Configure MetaMask for Sepolia network
2. Acquire Sepolia ETH from faucet
3. Connect wallet to frontend
4. Deposit USDC to FundPool
5. Submit encrypted DCA intents
6. Monitor batch processing and encrypted distributions
