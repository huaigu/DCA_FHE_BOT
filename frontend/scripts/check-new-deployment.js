const hre = require("hardhat");
const { ethers } = require("hardhat");

async function checkNewDeployment() {
    console.log("🔍 Checking new deployment status...");
    
    const userAddress = "0x170a6bbee5a0baa90012d9c5ca541f27afb43b9a";
    
    // New contract addresses
    const fundPoolAddress = "0x79FE21399cC9a67a71E7F2f2DDEcF605F256fadd";
    const intentCollectorAddress = "0x768Dd3993b5Ce23B64De65Db678f843564cbeCd5";
    const batchProcessorAddress = "0xC64ebE49d825C36cF377f98cE6C8F7c8E06d9ea4";
    
    try {
        // Get contract instances
        const FundPool = await ethers.getContractFactory("FundPool");
        const fundPool = FundPool.attach(fundPoolAddress);
        
        const IntentCollector = await ethers.getContractFactory("IntentCollector");
        const intentCollector = IntentCollector.attach(intentCollectorAddress);
        
        console.log("📋 New Contract Addresses:");
        console.log("├── FundPool:", fundPoolAddress);
        console.log("├── IntentCollector:", intentCollectorAddress);
        console.log("└── BatchProcessor:", batchProcessorAddress);
        
        // Check user state in new contracts
        const userState = await intentCollector.getUserState(userAddress);
        console.log("\n👤 User Status in New Deployment:");
        console.log("├── User State:", userState.toString());
        
        const stateNames = ["UNINITIALIZED", "ACTIVE", "WITHDRAWN"];
        console.log("├── State Name:", stateNames[userState] || "UNKNOWN");
        
        const canSubmit = await intentCollector.canSubmitIntent(userAddress);
        console.log("├── Can Submit Intent:", canSubmit);
        
        const isBalanceInit = await fundPool.isBalanceInitialized(userAddress);
        console.log("└── Balance Initialized:", isBalanceInit);
        
        // Check contract configurations
        console.log("\n🔧 Contract Configuration:");
        const poolIntentCollector = await fundPool.intentCollector();
        console.log("├── FundPool -> IntentCollector:", poolIntentCollector);
        
        const poolBatchProcessor = await fundPool.batchProcessor();
        console.log("├── FundPool -> BatchProcessor:", poolBatchProcessor);
        
        const collectorFundPool = await intentCollector.fundPool();
        console.log("└── IntentCollector -> FundPool:", collectorFundPool);
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

checkNewDeployment().catch(console.error);
