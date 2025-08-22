require('dotenv').config();
const { ethers } = require("ethers");

async function checkMinBatchSize() {
    console.log("🔍 Checking MinBatchSize...");
    
    // Load addresses from .env
    const intentCollectorAddress = process.env.NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS;
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
    
    if (!intentCollectorAddress || !rpcUrl) {
        console.error("❌ Missing required environment variables:");
        console.error("- NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS:", !!intentCollectorAddress);
        console.error("- NEXT_PUBLIC_SEPOLIA_RPC_URL:", !!rpcUrl);
        return;
    }
    
    try {
        console.log("📍 IntentCollector address:", intentCollectorAddress);
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        const abi = [
            "function minBatchSize() public view returns (uint256)"
        ];
        
        const intentCollector = new ethers.Contract(intentCollectorAddress, abi, provider);
        
        const minBatchSize = await intentCollector.minBatchSize();
        console.log("📊 Current MinBatchSize:", minBatchSize.toString());
        
        if (minBatchSize.toString() === "2") {
            console.log("✅ MinBatchSize successfully set to 2!");
        } else {
            console.log("⚠️  MinBatchSize is", minBatchSize.toString(), "(expected: 2)");
        }
        
    } catch (error) {
        console.error("❌ Error checking MinBatchSize:", error.message);
    }
}

checkMinBatchSize().catch(console.error);