const hre = require("hardhat");
const { ethers } = require("hardhat");

async function checkUserState() {
    console.log("🔍 Checking user state for address: 0x170a6bbee5a0baa90012d9c5ca541f27afb43b9a");
    
    const userAddress = "0x170a6bbee5a0baa90012d9c5ca541f27afb43b9a";
    
    // Get contract instances
    const intentCollectorAddress = "0x2f1DD937bAb10246139E626855071227e70738C4";
    const fundPoolAddress = "0xc0580b49B0e095cCB47FB6A9a79222106Aa93397";
    
    const IntentCollector = await ethers.getContractFactory("IntentCollector");
    const intentCollector = IntentCollector.attach(intentCollectorAddress);
    
    const FundPool = await ethers.getContractFactory("FundPool");
    const fundPool = FundPool.attach(fundPoolAddress);
    
    try {
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