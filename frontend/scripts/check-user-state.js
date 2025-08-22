require('dotenv').config();

async function checkUserState() {
    console.log("🔍 Checking user state for address: 0x170a6bbee5a0baa90012d9c5ca541f27afb43b9a");
    
    // Load addresses from .env
    const userAddress = "0x170a6bbee5a0baa90012d9c5ca541f27afb43b9a";
    const intentCollectorAddress = process.env.NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS;
    const fundPoolAddress = process.env.NEXT_PUBLIC_FUND_POOL_ADDRESS;
    
    if (!intentCollectorAddress || !fundPoolAddress) {
        console.error("❌ Missing required environment variables");
        return;
    }
    
    // Note: This script needs to be run with hardhat environment
    const hre = require("hardhat");
    const { ethers } = hre;
    
    try {
        // Get contract instances
        const IntentCollector = await ethers.getContractFactory("IntentCollector");
        const intentCollector = IntentCollector.attach(intentCollectorAddress);
        
        const FundPool = await ethers.getContractFactory("FundPool");
        const fundPool = FundPool.attach(fundPoolAddress);
        
        // Check user state in IntentCollector
        const userState = await intentCollector.getUserState(userAddress);
        console.log("📊 User State:", userState);
        
        // Check if user can submit intent
        const canSubmit = await intentCollector.canSubmitIntent(userAddress);
        console.log("✅ Can Submit Intent:", canSubmit);
        
        // Check balance initialization in FundPool
        const isBalanceInit = await fundPool.isBalanceInitialized(userAddress);
        console.log("💰 Balance Initialized:", isBalanceInit);
        
        // Check user intents
        const userIntents = await intentCollector.getUserIntents(userAddress);
        console.log("📝 User Intents:", userIntents.length);
        
        // Decode user state enum
        const stateNames = ["UNINITIALIZED", "ACTIVE", "WITHDRAWN"];
        console.log("🏷️  User State Name:", stateNames[userState] || "UNKNOWN");
        
    } catch (error) {
        console.error("❌ Error checking user state:", error.message);
    }
}

checkUserState().catch(console.error);