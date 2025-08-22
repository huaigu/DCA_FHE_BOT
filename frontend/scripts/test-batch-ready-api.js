require('dotenv').config();
const { ethers } = require("ethers");

async function testBatchReadyAPI() {
    console.log("🧪 Testing Batch Ready API calls...");
    
    // Load addresses from .env
    const intentCollectorAddress = process.env.NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS;
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
    
    if (!intentCollectorAddress || !rpcUrl) {
        console.error("❌ Missing required environment variables");
        return;
    }
    
    try {
        console.log("📍 Testing IntentCollector address:", intentCollectorAddress);
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Load ABI from file
        const intentCollectorAbi = require('../src/config/abis/IntentCollector.json');
        
        const intentCollector = new ethers.Contract(
            intentCollectorAddress, 
            intentCollectorAbi.abi, 
            provider
        );
        
        console.log("\n🔍 Testing checkBatchReady function...");
        
        // Test checkBatchReady function
        const readyInfo = await intentCollector.checkBatchReady();
        console.log("✅ checkBatchReady() successful:");
        console.log("  - isReady:", readyInfo[0]);
        console.log("  - batchId:", readyInfo[1].toString());
        
        // Test getBatchStats function
        console.log("\n🔍 Testing getBatchStats function...");
        const stats = await intentCollector.getBatchStats();
        console.log("✅ getBatchStats() successful:");
        console.log("  - currentBatch:", stats[0].toString());
        console.log("  - pendingCount:", stats[1].toString());
        console.log("  - timeRemaining:", stats[2].toString());
        
        // Test getPendingIntentsCount function
        console.log("\n🔍 Testing getPendingIntentsCount function...");
        const pendingCount = await intentCollector.getPendingIntentsCount();
        console.log("✅ getPendingIntentsCount() successful:");
        console.log("  - count:", pendingCount.toString());
        
        // Summary for frontend
        console.log("\n📋 Frontend Integration Summary:");
        console.log("✅ All API calls are working without authentication");
        console.log("✅ checkBatchReady returns:", readyInfo[0] ? "READY" : "NOT READY");
        console.log("✅ Current batch has", stats[1].toString(), "pending intents");
        
        if (readyInfo[0]) {
            console.log("🎯 Frontend should show: Batch Ready for Processing");
        } else {
            console.log("⏳ Frontend should show: Batch Not Ready");
        }
        
    } catch (error) {
        console.error("❌ Error testing API calls:", error.message);
        if (error.code) {
            console.error("Error code:", error.code);
        }
    }
}

testBatchReadyAPI().catch(console.error);