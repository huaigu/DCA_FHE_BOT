const hre = require("hardhat");
const { ethers } = require("hardhat");

async function checkFundPoolConfig() {
    console.log("🔍 Checking FundPool configuration...");
    
    const fundPoolAddress = "0xc0580b49B0e095cCB47FB6A9a79222106Aa93397";
    const intentCollectorAddress = "0x2f1DD937bAb10246139E626855071227e70738C4";
    
    const FundPool = await ethers.getContractFactory("FundPool");
    const fundPool = FundPool.attach(fundPoolAddress);
    
    try {
        // Check if IntentCollector address is set in FundPool
        const poolIntentCollector = await fundPool.intentCollector();
        console.log("💳 FundPool IntentCollector address:", poolIntentCollector);
        console.log("📍 Expected IntentCollector address:", intentCollectorAddress);
        console.log("✅ IntentCollector correctly set:", poolIntentCollector.toLowerCase() === intentCollectorAddress.toLowerCase());
        
        // Check if BatchProcessor address is set in FundPool  
        const poolBatchProcessor = await fundPool.batchProcessor();
        console.log("🔄 FundPool BatchProcessor address:", poolBatchProcessor);
        
        // Check FundPool in IntentCollector
        const IntentCollector = await ethers.getContractFactory("IntentCollector");
        const intentCollector = IntentCollector.attach(intentCollectorAddress);
        
        const collectorFundPool = await intentCollector.fundPool();
        console.log("📊 IntentCollector FundPool address:", collectorFundPool);
        console.log("✅ FundPool correctly set:", collectorFundPool.toLowerCase() === fundPoolAddress.toLowerCase());
        
    } catch (error) {
        console.error("❌ Error checking configuration:", error.message);
    }
}

checkFundPoolConfig().catch(console.error);
