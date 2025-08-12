# DCA FHE Bot Frontend

A privacy-preserving dollar-cost averaging (DCA) bot frontend built with Next.js, React, and Zama's fhEVM for fully homomorphic encryption.

## Features

- 🔐 **Encrypted DCA Intents**: Submit DCA parameters with full privacy using FHE
- 👥 **Batch Processing**: Monitor batch collection and execution status
- 💰 **Encrypted Balances**: View your token balances with client-side decryption
- 🔗 **Wallet Integration**: Connect MetaMask for Sepolia testnet
- 🎨 **Modern UI**: Beautiful interface with Tailwind CSS and shadcn/ui
- ⚡ **Real-time Updates**: Live batch status and balance monitoring

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Development Server**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js 13+ app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── DCAForm.tsx       # Encrypted intent submission
│   ├── BatchStatus.tsx   # Batch monitoring
│   ├── BalanceView.tsx   # Encrypted balance display
│   └── WalletConnect.tsx # Wallet connection
├── lib/                  # Utilities and store
│   ├── store.ts          # Zustand state management
│   └── utils.ts          # Helper functions
└── utils/                # FHE utilities
    └── fheEncryption.ts  # Client-side encryption
```

## Key Components

### DCAForm
- Encrypted intent submission form
- Price range conditions
- Real-time validation
- FHE encryption integration

### BatchStatus  
- Real-time batch monitoring
- Progress tracking
- Execution history
- K-anonymity visualization

### BalanceView
- Encrypted balance display
- Client-side decryption
- Privacy controls
- Transaction history

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### Environment Variables

Required environment variables:

```bash
NEXT_PUBLIC_CHAIN_ID=11155111                    # Sepolia testnet
NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS=0x...      # Intent collector contract
NEXT_PUBLIC_BATCH_PROCESSOR_ADDRESS=0x...       # Batch processor contract
NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ADDRESS=0x...    # Confidential token contract
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/... # Sepolia RPC endpoint
```

## FHE Integration

The frontend integrates with Zama's fhEVM for fully homomorphic encryption:

### Client-side Encryption
```typescript
// Encrypt DCA intent parameters
const encryptedIntent = await encryptDCAIntent({
  budget: BigInt(1000 * 1e6),      // 1000 USDC
  tradesCount: 10,                 // 10 trades
  amountPerTrade: BigInt(100 * 1e6), // 100 USDC per trade
  frequency: 86400,                // Daily (24 hours)
  minPrice: BigInt(1500 * 1e8),    // Min ETH price: $1500
  maxPrice: BigInt(2000 * 1e8),    // Max ETH price: $2000
}, contractAddress, userAddress)
```

### Balance Decryption
```typescript
// Decrypt encrypted balance locally
const decryptedBalance = await decryptUserBalance(
  encryptedBalance,
  contractAddress,
  signer
)
```

## Privacy Features

### Encrypted Parameters
- All DCA parameters encrypted before submission
- Price conditions remain private
- Investment amounts hidden from observers

### Batch Anonymity
- K-anonymity through batch processing
- Individual strategies cannot be identified
- Execution timing based on batch conditions

### Client-side Decryption
- Only user can decrypt their balances
- Private key required for decryption
- No plaintext data stored on-chain

## UI/UX Features

### Responsive Design
- Mobile-first responsive layout
- Touch-friendly interactions
- Progressive enhancement

### Animations
- Framer Motion animations
- Smooth transitions
- Loading states

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support

## Wallet Integration

### Supported Wallets
- MetaMask (primary)
- WalletConnect (future)
- Coinbase Wallet (future)

### Network Requirements
- Sepolia testnet (Chain ID: 11155111)
- Infura RPC endpoint
- Test ETH for gas fees

## Deployment

### Vercel (Recommended)
```bash
npm run build
# Deploy to Vercel
```

### Docker
```bash
docker build -t dca-fhe-bot-frontend .
docker run -p 3000:3000 dca-fhe-bot-frontend
```

### Static Export
```bash
npm run build
npm run export
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Follow code style guidelines
4. Add tests for new features
5. Submit pull request

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Support

- [Zama fhEVM Documentation](https://docs.zama.ai/fhevm)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)