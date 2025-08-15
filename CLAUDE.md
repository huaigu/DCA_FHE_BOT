# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Privacy-Preserving DCA (Dollar Cost Averaging) Bot** implementation using Fully Homomorphic Encryption (FHE) with the FHEVM protocol. The project consists of:

- **Smart Contracts**: Complete FHE-enabled Solidity contracts with encrypted price conditions and batch processing
- **Hardhat Environment**: Full development and testing framework with FHEVM integration
- **Deployment Target**: Sepolia testnet with comprehensive mock environment for local testing
- **Frontend**: Empty directory (Next.js + Tailwind CSS + shadcn + motion animations planned)
- **Oracle Integration**: Chainlink Price Feeds V3 and Automation with manual trigger fallback

## Core Architecture

### Privacy-Preserving DCA System
The system implements encrypted DCA strategies with dynamic price conditions:

- **IntentCollector.sol**: Collects encrypted DCA intents with price range parameters
- **BatchProcessor.sol**: Processes batches with FHE aggregation and price filtering
- **ConfidentialToken.sol**: Handles encrypted token balance distribution
- **Key Features**:
  - Encrypted DCA parameters (budget, trade count, frequency, price ranges)
  - FHE-based price condition evaluation
  - Batch processing for k-anonymity (target: 10 users per batch)
  - Proportional encrypted token distribution
  - Integration with Uniswap V3 for USDC → ETH swaps

### Enhanced Privacy Features
- **Encrypted Price Ranges**: Users submit encrypted `minPrice` and `maxPrice` for conditional execution
- **FHE Price Comparison**: Compare current ETH price (from Chainlink) against encrypted ranges using `FHE.gte()` and `FHE.lte()`
- **Private Strategy Filtering**: Only execute intents when price conditions are met, maintaining privacy of individual strategies
- **Batch Anonymity**: Observers cannot determine which users' strategies were executed in each batch

### Development Stack
- **Solidity**: v0.8.24 with Cancun EVM
- **FHEVM Libraries**: `@fhevm/solidity`, `@fhevm/hardhat-plugin`
- **Oracle Integration**: Chainlink Price Feeds V3, Chainlink Automation
- **DEX Integration**: Uniswap V3 for token swaps
- **Testing**: Chai with FHEVM-specific utilities and price simulation
- **Deployment**: Hardhat Deploy with network-specific configurations

## Essential Commands

### Environment Setup
```bash
# Install dependencies
npm install

# Set required environment variables
npx hardhat vars set PRIVATE_KEY      # Your private key for Sepolia deployment (without 0x)
npx hardhat vars set INFURA_API_KEY   # Your Infura API key for Sepolia RPC
npx hardhat vars set ETHERSCAN_API_KEY  # Optional for contract verification
npx hardhat vars set MNEMONIC         # Optional, only needed for local development
```

### Development Workflow
```bash
# Compile contracts
npm run compile

# Run tests (local only - uses FHEVM mock)
npm run test

# Run specific test file
npx hardhat test test/IntentCollector.test.ts
npx hardhat test test/integration/DCASystem.test.ts

# Test on Sepolia (requires deployed contract)
npm run test:sepolia
npx hardhat test --network sepolia
```

### Deployment & Interaction
```bash
# Start local FHEVM node
npx hardhat node

# Deploy to local network
npx hardhat deploy --network localhost

# Deploy to Sepolia
npx hardhat deploy --network sepolia

# Verify contracts on Etherscan (example)
npx hardhat verify --network sepolia <INTENT_COLLECTOR_ADDRESS> <OWNER_ADDRESS>
npx hardhat verify --network sepolia <CONFIDENTIAL_TOKEN_ADDRESS> "Confidential ETH" "cETH" 18 <WETH_ADDRESS> <OWNER_ADDRESS>
npx hardhat verify --network sepolia <BATCH_PROCESSOR_ADDRESS> <INTENT_COLLECTOR_ADDRESS> <CONFIDENTIAL_TOKEN_ADDRESS> <PRICE_FEED_ADDRESS> <ROUTER_ADDRESS> <USDC_ADDRESS> <WETH_ADDRESS> <OWNER_ADDRESS>
```

### Contract Interaction Tasks
```bash
# Get contract addresses
npx hardhat task:address --network localhost
npx hardhat task:address --network sepolia

# Check system status
npx hardhat task:batch-status --network localhost
npx hardhat task:system-info --network localhost

# Submit a DCA intent
npx hardhat task:submit-intent --network localhost --budget 1000 --trades 10 --amount 100 --frequency 86400 --min-price 1500 --max-price 2000

# Process a batch manually (owner only)
npx hardhat task:process-batch --network localhost --batch-id 1

# Check user balance
npx hardhat task:user-balance --network localhost
npx hardhat task:user-balance --network localhost --user 0x1234...
```

### Code Quality
```bash
# Run all linting
npm run lint

# Lint Solidity only
npm run lint:sol

# Lint TypeScript only
npm run lint:ts

# Format code
npm run prettier:write

# Generate test coverage
npm run coverage

# Clean build artifacts
npm run clean
```

## FHE Development Patterns

### DCA Intent Structure (Actual Implementation)
```solidity
struct EncryptedIntent {
    euint64 budget;          // Total USDC budget
    euint32 tradesCount;     // Number of trades to execute
    euint64 amountPerTrade;  // USDC amount per trade
    euint32 frequency;       // Frequency in seconds between trades
    euint64 minPrice;        // Minimum ETH price (encrypted)
    euint64 maxPrice;        // Maximum ETH price (encrypted)
    address user;            // Intent owner
    uint256 submittedAt;     // Timestamp when intent was submitted
    uint256 batchId;         // ID of the batch this intent belongs to
    bool isActive;           // Whether the intent is active
    bool isProcessed;        // Whether the intent has been processed
}
```

### Price Condition Evaluation (Actual Implementation)
```solidity
function _shouldExecuteIntent(
    IntentCollector.EncryptedIntent memory intent,
    euint64 currentPrice
) internal returns (ebool shouldExecute) {
    // Check if current price is within the intent's price range
    ebool isAboveMin = FHE.ge(currentPrice, intent.minPrice);
    ebool isBelowMax = FHE.le(currentPrice, intent.maxPrice);
    shouldExecute = FHE.and(isAboveMin, isBelowMax);
}
```

### Batch Aggregation (Actual Implementation)
```solidity
function _filterAndAggregateIntents(uint256[] memory intentIds, uint256 currentPrice)
    internal
    returns (uint256[] memory validIntentIds, euint64 totalAmount)
{
    uint256[] memory tempValidIds = new uint256[](intentIds.length);
    uint256 validCount = 0;
    totalAmount = FHE.asEuint64(0);
    
    // Convert current price to euint64 for FHE comparison
    euint64 currentPriceEncrypted = FHE.asEuint64(uint64(currentPrice));
    
    for (uint256 i = 0; i < intentIds.length; i++) {
        uint256 intentId = intentIds[i];
        IntentCollector.EncryptedIntent memory intent = intentCollector.getIntent(intentId);
        
        // Check if intent should execute based on encrypted price conditions
        ebool shouldExecute = _shouldExecuteIntent(intent, currentPriceEncrypted);
        
        // Get the amount for this intent
        euint64 intentAmount = FHE.mul(intent.amountPerTrade, FHE.asEuint64(1));
        
        // Use conditional selection to add amount only if intent should execute
        euint64 conditionalAmount = FHE.select(shouldExecute, intentAmount, FHE.asEuint64(0));
        totalAmount = FHE.add(totalAmount, conditionalAmount);
        
        tempValidIds[validCount] = intentId;
        validCount++;
    }
    
    // Create properly sized array
    validIntentIds = new uint256[](validCount);
    for (uint256 i = 0; i < validCount; i++) {
        validIntentIds[i] = tempValidIds[i];
    }
}
```

### Encrypted Operations
- All arithmetic operations use FHE library functions (`FHE.add()`, `FHE.sub()`, `FHE.mul()`)
- Price comparisons use `FHE.ge()`, `FHE.le()`, `FHE.and()` for conditions
- Conditional selection with `FHE.select(condition, ifTrue, ifFalse)`
- Type conversion with `FHE.asEuint64(uint64(value))` for plaintext to encrypted
- Encrypted inputs require proofs: `FHE.fromExternal(inputEuint64, inputProof)`
- Always call `FHE.allowThis()` and `FHE.allow()` after state updates

### Testing Strategy
- **Local Tests**: Use FHEVM mock environment (`fhevm.isMock` check) for rapid development
- **Price Simulation**: Mock Chainlink price feeds for testing price conditions
- **Batch Testing**: Simulate multiple users with different price ranges
- **Sepolia Tests**: Real FHE operations with actual encryption/decryption and live price feeds
- **Encryption**: `fhevm.createEncryptedInput().add64(value).encrypt()` for euint64
- **Decryption**: `fhevm.userDecryptEuint(FhevmType.euint64, encryptedValue, contractAddress, signer)`

### Network Configuration
- **Local**: Hardhat network with FHEVM mock (chainId: 31337)
- **Sepolia**: Real FHEVM with Infura RPC (chainId: 11155111)
- **Test Detection**: Use `fhevm.isMock` to skip network-specific tests
- **Oracle Integration**: Mock price feeds locally, real Chainlink feeds on Sepolia

## Key Files & Structure

```
├── contracts/
│   ├── IntentCollector.sol          # Main intent collection and batch management
│   ├── BatchProcessor.sol           # Core processing with FHE aggregation and price filtering
│   ├── ConfidentialToken.sol        # Encrypted ERC20 token with FHE balances
│   ├── interfaces/
│   │   ├── IChainlinkAggregator.sol  # Chainlink price feed interface
│   │   ├── IUniswapV3Router.sol      # Uniswap V3 router interface
│   │   └── IChainlinkAutomation.sol  # Chainlink automation interface
│   └── mocks/
│       ├── MockPriceFeed.sol         # Mock Chainlink price feed for testing
│       ├── MockUniswapRouter.sol     # Mock Uniswap V3 router for testing
│       └── MockERC20.sol             # Mock USDC token for testing
├── deploy/
│   └── deploy.ts                     # Comprehensive deployment script
├── tasks/
│   ├── DCAFHEBot.ts                 # Complete DCA system interaction tasks
│   └── accounts.ts                   # Account management tasks
├── test/
│   ├── IntentCollector.test.ts       # Intent collection and batch management tests
│   ├── ConfidentialToken.test.ts     # Encrypted token functionality tests
│   ├── BatchProcessor.test.ts        # Batch processing and automation tests
│   └── integration/
│       └── DCASystem.test.ts         # End-to-end system integration tests
├── frontend/                         # Empty directory (Next.js + Tailwind planned)
└── hardhat.config.ts                 # Network configuration with viaIR compilation
```

## Important Notes

### DCA Bot Implementation Details
- **Batch Processing**: MIN_BATCH_SIZE = 5, MAX_BATCH_SIZE = 10 for k-anonymity
- **Price Filtering**: FHE-based price condition evaluation with `FHE.ge()` and `FHE.le()`
- **Oracle Integration**: Chainlink Price Feeds V3 for ETH/USD with staleness checks
- **DEX Integration**: Uniswap V3 router with single aggregated swap (USDC → ETH)
- **Automation**: Chainlink Automation with manual trigger fallback for testing
- **Token Distribution**: Encrypted proportional distribution via ConfidentialToken
- **Network Support**: Comprehensive localhost/hardhat testing + Sepolia deployment

### FHEVM Implementation Notes
- **Compilation**: Uses viaIR: true to handle "stack too deep" errors with complex FHE operations
- **Gas Optimization**: 800 optimizer runs for FHE operation efficiency
- **Type System**: euint64 for amounts/prices, euint32 for counts, ebool for conditions
- **Function Names**: `FHE.ge()` not `FHE.gte()`, `FHE.select()` not `FHE.cmux()`
- **Type Conversion**: `FHE.asEuint64(uint64(value))` requires explicit uint64 casting
- **Testing**: Mock environment for rapid development, Sepolia for real FHE validation
- **Permissions**: Proper FHE.allowThis() and FHE.allow() setup for encrypted state

### Integration Requirements
- **Chainlink Price Feed**: ETH/USD price oracle on Sepolia
- **Uniswap V3**: Token swap router and pool contracts
- **Automation**: Chainlink Automation for batch trigger timing
- **Frontend Encryption**: Client-side parameter encryption before submission

## DCA Strategy Implementation

### Encrypted Intent Submission
```typescript
// Client-side encryption example
const encryptedInput = fhevm.createEncryptedInput(contractAddress, userAddress);
encryptedInput.add64(budget);      // Total USDC budget
encryptedInput.add32(tradesCount); // Number of trades
encryptedInput.add32(amountPerTrade); // USDC per trade
encryptedInput.add32(frequency);   // Execution frequency
encryptedInput.add64(minPrice);    // Min ETH price (e.g., 1500 USDC)
encryptedInput.add64(maxPrice);    // Max ETH price (e.g., 2000 USDC)

const inputProof = encryptedInput.encrypt();
await contract.submitIntent(inputProof.handles, inputProof.inputProof);
```

### Batch Processing Flow
1. **Intent Collection**: Users submit encrypted DCA parameters
2. **Price Evaluation**: Compare current ETH price against encrypted ranges
3. **Conditional Aggregation**: Sum amounts only for intents meeting price conditions
4. **DEX Execution**: Single swap for aggregated amount
5. **Encrypted Distribution**: Allocate tokens proportionally in encrypted form

### Privacy Guarantees
- **Parameter Privacy**: All DCA settings remain encrypted on-chain
- **Strategy Privacy**: Observers cannot determine individual execution conditions
- **Amount Privacy**: Individual investment amounts are hidden in batch aggregation
- **Timing Privacy**: Execution timing depends on batch conditions, not individual preferences

## Troubleshooting

### DCA Bot Issues
- **Intent Not Executing**: Check if current price is within encrypted range
- **Batch Not Processing**: Verify batch size threshold and timing conditions
- **Price Feed Errors**: Ensure Chainlink oracle is updated and accessible
- **Uniswap Failures**: Check token approvals and liquidity availability

### Development Issues
- **Test Skips**: Check `fhevm.isMock` conditions in test files
- **Deployment Issues**: Ensure all contracts are deployed in correct order
- **Network Errors**: Verify Infura API key and network connectivity
- **Type Generation**: Run `npm run typechain` after compilation issues
- **FHE Errors**: Ensure all encrypted operations use proper FHE functions