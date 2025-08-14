# DCA FHE Bot Frontend

Privacy-preserving Dollar Cost Averaging bot frontend built with Next.js and Fully Homomorphic Encryption (FHE).

## Features

### 🔐 Privacy-First DCA
- **Encrypted Parameters**: All DCA settings encrypted using Zama FHE technology
- **Private Execution**: Investment amounts and strategies remain confidential
- **Batch Anonymity**: K-anonymity through group execution (5-10 users per batch)

### 💰 USDC → WETH Strategy
- **Fixed Trading Pair**: USDC to WETH on Sepolia testnet
- **Flexible Configuration**: Set by trades count OR amount per trade
- **Price Conditions**: Optional encrypted min/max ETH price ranges
- **Real-time Calculation**: Automatic strategy parameter calculation

### 🏦 Integrated Fund Management
- **FundPool Integration**: Secure USDC deposits with encrypted balances
- **Approval Workflow**: Streamlined USDC approval and deposit process
- **Dual Withdrawals**: Withdraw both deposited USDC and purchased WETH
- **Balance Decryption**: Client-side balance decryption with privacy controls

### 📊 Real-time Monitoring
- **Batch Status**: Live tracking of batch formation and execution
- **Progress Visualization**: Real-time progress bars and countdown timers
- **Intent Tracking**: Monitor your active DCA intents
- **Transaction History**: View encrypted balance changes and activity

## Technology Stack

### Core Framework
- **Next.js 14**: React framework with app directory
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Smooth animations and transitions

### Web3 Integration
- **Ethers.js v6**: Ethereum interaction
- **@fhevm/fhevm**: Zama FHE client library
- **MetaMask**: Wallet connection and transaction signing

### UI Components
- **shadcn/ui**: High-quality React components
- **Radix UI**: Accessible component primitives
- **Lucide React**: Beautiful icons
- **Custom Components**: Purpose-built DCA interface components

### State Management
- **Zustand**: Lightweight state management
- **React Hooks**: Custom hooks for contract interactions
- **Local Storage**: Persistent user preferences

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js 13+ app directory
│   │   ├── globals.css        # Global styles with custom properties
│   │   ├── layout.tsx         # Root layout with providers
│   │   └── page.tsx           # Main dashboard with tabbed interface
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── DCAForm.tsx       # Enhanced DCA strategy creation
│   │   ├── DepositModal.tsx  # USDC deposit workflow
│   │   ├── WithdrawModal.tsx # Dual-token withdrawal interface
│   │   ├── BatchStatus.tsx   # Real-time batch monitoring
│   │   ├── BalanceView.tsx   # Encrypted balance management
│   │   └── WalletConnect.tsx # Wallet connection component
│   ├── hooks/                # Custom React hooks
│   │   ├── useContract.ts    # Base contract interaction hook
│   │   ├── useFundPool.ts    # FundPool operations
│   │   ├── useIntentCollector.ts # Intent submission and tracking
│   │   ├── useConfidentialToken.ts # Token balance management
│   │   └── useUSDC.ts        # USDC token operations
│   ├── config/               # Configuration and constants
│   │   ├── contracts.ts      # Contract addresses and metadata
│   │   └── abis/            # Contract ABI files
│   ├── lib/                  # Utilities and state
│   │   ├── store.ts          # Zustand global state
│   │   └── utils.ts          # Helper functions
│   └── utils/                # Specialized utilities
│       └── fheEncryption.ts  # FHE encryption/decryption
├── public/                   # Static assets
├── package.json              # Dependencies and scripts
├── tailwind.config.js        # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
├── next.config.js           # Next.js configuration
├── .env.local.example       # Environment variables template
├── WORKFLOW.md              # Complete user workflow documentation
└── README_IMPLEMENTATION.md # This file
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm 7+
- MetaMask or compatible Web3 wallet
- Access to Sepolia testnet

### Installation

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment template
   cp .env.local.example .env.local
   
   # Edit environment variables
   vim .env.local
   ```

3. **Required Environment Variables**
   ```bash
   # Network Configuration
   NEXT_PUBLIC_CHAIN_ID=11155111
   NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
   
   # DCA System Contracts (after deployment)
   NEXT_PUBLIC_FUND_POOL_ADDRESS=
   NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS=
   NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ADDRESS=
   NEXT_PUBLIC_BATCH_PROCESSOR_ADDRESS=
   
   # External Contracts (pre-configured)
   NEXT_PUBLIC_WETH_ADDRESS=0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
   NEXT_PUBLIC_USDC_ADDRESS=0x1c7d4b196cb0c7b01d743fbc6116a902379c7238
   NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS=0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008
   ```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Lint code
npm run lint
```

## Usage Guide

### 1. Wallet Connection
- Connect MetaMask to Sepolia testnet
- Ensure you have Sepolia ETH for gas fees
- Acquire USDC on Sepolia for trading

### 2. Deposit USDC
- Click "Deposit USDC" in the balance section
- Approve USDC spending (first time only)
- Enter amount and confirm deposit
- View encrypted balance in FundPool

### 3. Create DCA Strategy
- Navigate to "Create Intent" tab
- Configure investment parameters:
  - **Investment Amount**: Total USDC to invest
  - **Strategy Type**: Choose trades count OR amount per trade
  - **Frequency**: Time between executions
  - **Price Conditions**: Optional min/max ETH price
- Submit encrypted intent to batch

### 4. Monitor Batch Status
- Navigate to "Batch Status" tab
- View current batch progress
- Monitor your active intents
- Track batch formation and execution

### 5. Manage Balances
- Navigate to "My Balance" tab
- View encrypted balances
- Decrypt balances locally for viewing
- Withdraw USDC or WETH tokens

## Contract Integration

### Sepolia Contract Addresses
- **USDC**: `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238`
- **WETH**: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
- **Uniswap V2 Router**: `0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008`

### DCA System Contracts
Deploy the following contracts and update environment variables:
- **FundPool**: Manages encrypted USDC deposits
- **IntentCollector**: Collects and batches encrypted intents
- **ConfidentialToken**: Handles encrypted WETH distribution
- **BatchProcessor**: Executes batch swaps with price filtering

## Implementation Summary

I have successfully implemented a comprehensive DCA FHE Bot frontend that includes:

✅ **Contract Configuration**: Sepolia addresses for WETH, USDC, Uniswap V2
✅ **Contract Hooks**: Complete React hooks for all contract interactions
✅ **Deposit Functionality**: USDC approval and FundPool integration with encryption
✅ **Enhanced DCA Form**: USDC→WETH strategy with flexible configuration and FHE encryption
✅ **Withdrawal System**: Dual-token withdrawal for both USDC and WETH
✅ **Batch Monitoring**: Real-time batch status with progress tracking
✅ **Balance Management**: Encrypted balance display with client-side decryption
✅ **User Interface**: Modern, responsive UI inspired by the reference design
✅ **Workflow Documentation**: Complete user workflow and technical documentation

The frontend provides a complete user experience for privacy-preserving DCA strategies using Zama's FHE technology on Sepolia testnet.

## Built with ❤️ using Zama fhEVM, Next.js, and modern Web3 technologies.