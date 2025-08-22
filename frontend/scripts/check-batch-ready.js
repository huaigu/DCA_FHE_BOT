require('dotenv').config();
const { ethers } = require("ethers");

async function checkBatchReady() {
    console.log("🔍 Checking BatchReady status...");
    
    // Load addresses from .env
    const intentCollectorAddress = process.env.NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS;
    const batchProcessorAddress = process.env.NEXT_PUBLIC_BATCH_PROCESSOR_ADDRESS;
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
    
    if (!intentCollectorAddress || !batchProcessorAddress || !rpcUrl) {
        console.error("❌ Missing required environment variables:");
        console.error("- NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS:", !!intentCollectorAddress);
        console.error("- NEXT_PUBLIC_BATCH_PROCESSOR_ADDRESS:", !!batchProcessorAddress);
        console.error("- NEXT_PUBLIC_SEPOLIA_RPC_URL:", !!rpcUrl);
        return;
    }
    
    try {
        console.log("📍 IntentCollector address:", intentCollectorAddress);
        console.log("📍 BatchProcessor address:", batchProcessorAddress);
        
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // IntentCollector ABI
        const intentCollectorAbi = [
            "function checkBatchReady() external view returns (bool isReady, uint256 batchId)",
            "function getBatchStats() external view returns (uint256 currentBatch, uint256 pendingCount, uint256 timeRemaining)",
            "function minBatchSize() public view returns (uint256)",
            "function getPendingIntentsCount() external view returns (uint256)",
            "function currentBatchStartTime() external view returns (uint256)"
        ];
        
        // BatchProcessor ABI  
        const batchProcessorAbi = [
            "function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData)"
        ];
        
        const intentCollector = new ethers.Contract(intentCollectorAddress, intentCollectorAbi, provider);
        const batchProcessor = new ethers.Contract(batchProcessorAddress, batchProcessorAbi, provider);
        
        console.log("\n📊 Batch Status Information:");
        
        // Check batch ready status
        const [isReady, batchId] = await intentCollector.checkBatchReady();
        console.log("├── Batch Ready:", isReady);
        console.log("├── Current Batch ID:", batchId.toString());
        
        // Get batch stats
        const [currentBatch, pendingCount, timeRemaining] = await intentCollector.getBatchStats();
        console.log("├── Current Batch:", currentBatch.toString());
        console.log("├── Pending Intents:", pendingCount.toString());
        console.log("├── Time Remaining:", timeRemaining.toString(), "seconds");
        
        // Get min batch size
        const minBatchSize = await intentCollector.minBatchSize();
        console.log("├── Min Batch Size:", minBatchSize.toString());
        
        // Get current batch start time
        const batchStartTime = await intentCollector.currentBatchStartTime();
        const currentTime = Math.floor(Date.now() / 1000);
        const elapsedTime = currentTime - Number(batchStartTime);
        console.log("├── Batch Start Time:", new Date(Number(batchStartTime) * 1000).toISOString());
        console.log("├── Elapsed Time:", elapsedTime, "seconds");
        
        // Check Chainlink automation readiness
        console.log("\n🤖 Chainlink Automation Status:");
        try {
            // Create checkData for BatchProcessor (minBatchSize=2, maxPriceAge=7200)
            const checkData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [2, 7200]);
            
            const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep(checkData);
            console.log("├── Upkeep Needed:", upkeepNeeded);
            console.log("└── Perform Data Length:", performData.length);
            
            if (upkeepNeeded) {
                console.log("🎯 Batch is ready for processing!");
            } else {
                console.log("⏳ Batch is not ready yet");
            }
            
        } catch (error) {
            console.log("└── Automation check failed:", error.message);
        }
        
        // Summary
        console.log("\n📋 Summary:");
        if (isReady) {
            console.log("✅ Batch is ready for processing");
            console.log(`📦 ${pendingCount} intents in current batch (min required: ${minBatchSize})`);
        } else {
            const needMoreIntents = Number(pendingCount) < Number(minBatchSize);
            const needMoreTime = timeRemaining > 0;
            
            if (needMoreIntents && needMoreTime) {
                console.log(`⏳ Need ${Number(minBatchSize) - Number(pendingCount)} more intents OR wait ${timeRemaining}s for timeout`);
            } else if (needMoreIntents) {
                console.log(`📝 Need ${Number(minBatchSize) - Number(pendingCount)} more intents (timeout reached)`);
            } else {
                console.log("⏳ Waiting for timeout...");
            }
        }
        
    } catch (error) {
        console.error("❌ Error checking batch status:", error.message);
        if (error.code) {
            console.error("Error code:", error.code);
        }
    }
}

checkBatchReady().catch(console.error);