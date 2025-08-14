# DCA FHE Bot - Complete User Workflow Documentation

## Overview

The DCA FHE Bot provides a privacy-preserving Dollar Cost Averaging system using Fully Homomorphic Encryption (FHE). Users can create encrypted DCA strategies that execute automatically in batches while keeping all parameters private.

## System Architecture

### Core Contracts
- **FundPool**: Manages encrypted USDC deposits with privacy-preserving balance tracking
- **IntentCollector**: Collects encrypted DCA intents and manages batch formation
- **ConfidentialToken**: Handles encrypted distribution of purchased WETH tokens
- **BatchProcessor**: Executes batch swaps with FHE price filtering and aggregation

### External Contracts (Sepolia)
- **USDC**: `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238` (Base trading token)
- **WETH**: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` (Target purchase token)
- **Uniswap V2 Router**: `0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008` (DEX for swaps)

## Complete User Workflow

### Phase 1: Initial Setup & Connection

#### 1.1 Wallet Connection
```typescript
// User connects MetaMask to Sepolia testnet
- Network: Sepolia (chainId: 11155111)
- Required: MetaMask or compatible wallet
- Auto-detection: Frontend switches to Sepolia if needed
```

#### 1.2 USDC Acquisition
```typescript
// User needs USDC on Sepolia for trading
- Option 1: Bridge from mainnet
- Option 2: Use testnet faucet (if available)
- Option 3: Acquire from DEX (swap ETH → USDC)
```

### Phase 2: Deposit & Strategy Setup

#### 2.1 Deposit USDC to FundPool
```typescript
/**
 * Step 1: Approve USDC spending
 */
await usdcContract.approve(FUND_POOL_ADDRESS, amount);

/**
 * Step 2: Encrypt amount and deposit
 */
const { encryptedData, proof } = await encryptAmount(amount, contractAddress, userAddress);
await fundPool.deposit(encryptedData, proof, amount);

/**
 * Result: User has encrypted USDC balance in FundPool
 */
```

#### 2.2 Create DCA Strategy
```typescript
/**
 * DCA Strategy Parameters (all encrypted)
 */
interface DCAStrategy {
  budget: bigint;           // Total USDC to invest (e.g., 1000 USDC)
  tradesCount: number;      // Number of trades (e.g., 10)
  amountPerTrade: bigint;   // USDC per trade (auto-calculated: 100 USDC)
  frequency: number;        // Seconds between trades (e.g., 86400 = 1 day)
  minPrice?: bigint;        // Min ETH price in cents (e.g., 150000 = $1500)
  maxPrice?: bigint;        // Max ETH price in cents (e.g., 200000 = $2000)
}

/**
 * Encryption & Submission
 */
const encryptedParams = await encryptDCAIntent(strategy, contractAddress, userAddress);
const intentId = await intentCollector.submitIntent(...encryptedParams);
```

### Phase 3: Batch Processing & Execution

#### 3.1 Batch Formation
```typescript
/**
 * Batch Rules
 */
const BATCH_CONFIG = {
  MIN_SIZE: 5,              // Minimum users for batch execution
  MAX_SIZE: 10,             // Maximum users per batch
  TIMEOUT: 300,             // 5 minutes timeout
};

/**
 * Batch States
 */
type BatchState = 
  | 'waiting'    // < 5 intents
  | 'collecting' // 5-9 intents, waiting for more or timeout
  | 'ready'      // 10 intents or timeout reached
  | 'processing' // Executing swaps
  | 'completed'  // Finished
```

#### 3.2 FHE Price Filtering
```solidity
/**
 * Privacy-Preserving Price Evaluation
 */
function _shouldExecuteIntent(
    EncryptedIntent memory intent,
    euint64 currentPrice
) internal returns (ebool shouldExecute) {
    // Compare encrypted price conditions
    ebool isAboveMin = FHE.ge(currentPrice, intent.minPrice);
    ebool isBelowMax = FHE.le(currentPrice, intent.maxPrice);
    shouldExecute = FHE.and(isAboveMin, isBelowMax);
}
```

#### 3.3 Batch Execution
```typescript
/**
 * Batch Processing Flow
 */
1. Collect qualifying intents (price conditions met)
2. Aggregate USDC amounts using FHE operations
3. Execute single Uniswap swap: USDC → WETH
4. Distribute WETH proportionally using encrypted amounts
5. Update user balances in ConfidentialToken
```

### Phase 4: Token Management & Withdrawal

#### 4.1 View Encrypted Balances
```typescript
/**
 * Balance Types
 */
interface UserBalances {
  fundPoolUSDC: string;     // Encrypted USDC in FundPool
  purchasedWETH: string;    // Encrypted WETH from DCA executions
}

/**
 * Client-side Decryption (Optional)
 */
const decryptedBalance = await fhevm.userDecryptEuint64(
  encryptedBalance,
  contractAddress,
  userSigner
);
```

#### 4.2 Withdrawal Options
```typescript
/**
 * Withdraw Unused USDC
 */
await fundPool.withdraw(amount, proof);

/**
 * Withdraw Purchased WETH
 */
await confidentialToken.withdraw(amount, encryptedProof);
```

## Privacy Features

### 1. Parameter Privacy
- **Investment amounts**: Encrypted using FHE before submission
- **Price conditions**: Hidden min/max price ranges
- **Timing preferences**: Encrypted frequency settings
- **Strategy details**: All parameters remain private on-chain

### 2. Execution Privacy
- **Batch anonymity**: Individual strategies hidden in group execution
- **Amount privacy**: Observers cannot determine individual contributions
- **Price privacy**: Condition evaluation happens in encrypted space
- **Timing privacy**: Execution depends on batch conditions, not individual timing

### 3. Balance Privacy
- **Encrypted storage**: All balances stored as encrypted values
- **Client-side decryption**: Only user can view actual amounts
- **Zero-knowledge proofs**: Withdrawals require cryptographic proofs

## Technical Implementation

### Frontend Components

#### 1. DCAForm Component
```typescript
/**
 * Features
 */
- USDC → WETH strategy setup (fixed trading pair)
- Flexible configuration: trades count OR amount per trade
- Optional price conditions (min/max ETH price)
- Real-time calculation of strategy parameters
- Integration with FundPool for balance validation
```

#### 2. DepositModal Component
```typescript
/**
 * Features
 */
- USDC approval workflow
- Encrypted deposit to FundPool
- Balance tracking and validation
- Transaction status monitoring
```

#### 3. BatchStatus Component
```typescript
/**
 * Features
 */
- Real-time batch progress monitoring
- K-anonymity visualization (users in batch)
- Countdown timer for batch timeout
- User's active intents tracking
```

#### 4. BalanceView Component
```typescript
/**
 * Features
 */
- Encrypted balance display
- Client-side decryption functionality
- Withdrawal interface for both USDC and WETH
- DCA activity overview
```

#### 5. WithdrawModal Component
```typescript
/**
 * Features
 */
- Dual-token withdrawal (USDC/WETH)
- Balance decryption before withdrawal
- Proof generation for encrypted amounts
- Transaction confirmation workflow
```

### Contract Hooks

#### 1. useFundPool Hook
```typescript
/**
 * Operations
 */
- deposit(amount, contractAddress, userAddress)
- withdraw(amount, proof)
- getEncryptedBalance(user)
- formatBalance(encryptedValue)
```

#### 2. useIntentCollector Hook
```typescript
/**
 * Operations
 */
- submitIntent(params, contractAddress, userAddress)
- getUserIntents(userAddress)
- getBatchStatus()
- calculateStrategy(params)
```

#### 3. useConfidentialToken Hook
```typescript
/**
 * Operations
 */
- initializeBalance()
- withdraw(amount, proof)
- getEncryptedBalance(user)
- encryptedTransfer(to, amount, proof)
```

#### 4. useUSDC Hook
```typescript
/**
 * Operations
 */
- approve(spender, amount)
- getBalance(user)
- getAllowance(owner, spender)
- formatAmount(amount)
```

## Environment Configuration

### Required Environment Variables
```bash
# Network Configuration
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY

# DCA System Contracts (to be deployed)
NEXT_PUBLIC_FUND_POOL_ADDRESS=
NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS=
NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ADDRESS=
NEXT_PUBLIC_BATCH_PROCESSOR_ADDRESS=

# External Contracts (already on Sepolia)
NEXT_PUBLIC_WETH_ADDRESS=0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
NEXT_PUBLIC_USDC_ADDRESS=0x1c7d4b196cb0c7b01d743fbc6116a902379c7238
NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS=0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008
```

### Development Setup
```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## User Journey Examples

### Example 1: Conservative DCA Strategy
```typescript
/**
 * User: Alice wants to DCA $1000 into ETH over 10 trades
 */
const strategy = {
  investmentAmount: "1000",     // $1000 USDC total
  tradesCount: 10,              // 10 separate purchases
  amountPerTrade: "100",        // $100 per trade (auto-calculated)
  frequency: 86400,             // Daily (24 hours)
  minPrice: "1500",             // Only buy if ETH > $1500
  maxPrice: "2500",             // Only buy if ETH < $2500
};

/**
 * Execution Timeline
 */
Day 1: Submit encrypted intent to batch
Day 1: Batch executes (if 5+ users, price conditions met)
Day 2: Next batch processes Alice's intent again
...continues for 10 successful executions
```

### Example 2: Aggressive DCA Strategy
```typescript
/**
 * User: Bob wants to DCA $500 into ETH with no price conditions
 */
const strategy = {
  investmentAmount: "500",      // $500 USDC total
  tradesCount: 5,               // 5 trades
  amountPerTrade: "100",        // $100 per trade
  frequency: 3600,              // Hourly
  minPrice: undefined,          // No minimum price
  maxPrice: undefined,          // No maximum price
};

/**
 * Result: More frequent execution, higher fill rate
 */
```

## Security Considerations

### 1. Smart Contract Security
- **Reentrancy protection**: All state-changing functions protected
- **Access controls**: Proper role-based permissions
- **Input validation**: Comprehensive parameter checking
- **Emergency controls**: Owner-only emergency functions

### 2. FHE Security
- **Encryption standards**: Zama FHEVM protocol compliance
- **Key management**: Client-side key derivation
- **Proof verification**: Cryptographic proof validation
- **Side-channel protection**: Timing attack mitigation

### 3. Frontend Security
- **Input sanitization**: All user inputs validated
- **XSS protection**: Content Security Policy implemented
- **Wallet security**: Secure wallet integration patterns
- **API security**: Rate limiting and input validation

## Monitoring & Analytics

### 1. User Metrics
- **Active intents**: Number of pending DCA strategies
- **Execution rate**: Percentage of intents executed
- **Average batch size**: Users per batch execution
- **Price condition efficiency**: How often conditions are met

### 2. System Metrics
- **Batch formation time**: Average time to form batches
- **Transaction costs**: Gas costs per batch execution
- **Slippage**: Price impact of batch swaps
- **Uptime**: System availability metrics

### 3. Privacy Metrics
- **Anonymity set size**: Average users per batch
- **Information leakage**: Zero by design verification
- **Decryption frequency**: How often users decrypt balances

## Troubleshooting Guide

### Common Issues

#### 1. Transaction Failures
```typescript
/**
 * Issue: Transaction reverts
 * Causes:
 */
- Insufficient USDC balance
- Inadequate gas allowance
- Contract address misconfiguration
- Network connectivity issues

/**
 * Solutions:
 */
- Verify USDC balance and allowance
- Increase gas limit/price
- Check contract addresses in environment
- Switch to different RPC endpoint
```

#### 2. Batch Not Executing
```typescript
/**
 * Issue: Intent submitted but batch not processing
 * Causes:
 */
- Insufficient users in batch (< 5)
- Price conditions not met
- Batch timeout not reached
- Contract paused

/**
 * Solutions:
 */
- Wait for more users or timeout
- Adjust price conditions
- Check contract status
- Monitor batch statistics
```

#### 3. Balance Decryption Issues
```typescript
/**
 * Issue: Cannot decrypt encrypted balance
 * Causes:
 */
- Incorrect private key
- Network connection issues
- Contract permission errors
- FHE library problems

/**
 * Solutions:
 */
- Verify wallet connection
- Check network connectivity
- Refresh page and reconnect
- Update browser/wallet extension
```

## Conclusion

The DCA FHE Bot provides a comprehensive privacy-preserving DCA solution with:

1. **Complete Privacy**: All parameters encrypted using FHE
2. **Batch Efficiency**: Optimal gas costs through batching
3. **Flexible Strategies**: Customizable DCA parameters
4. **User-Friendly Interface**: Intuitive React frontend
5. **Secure Operations**: Comprehensive security measures

The system enables users to execute dollar-cost averaging strategies while maintaining complete privacy of their investment parameters, amounts, and strategies through cutting-edge FHE technology.