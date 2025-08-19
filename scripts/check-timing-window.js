#!/usr/bin/env node

const { ethers } = require("hardhat");

async function checkTimingWindow() {
  console.log("🕐 Timing Window Analysis");
  console.log("=========================");
  
  const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
  
  try {
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
    const intentCollectorAddress = await batchProcessor.intentCollector();
    const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorAddress);
    
    // 获取批次信息
    const [isReady, batchId, intentIds] = await intentCollector.checkBatchReady();
    
    // 获取详细信息
    const batchCounter = await intentCollector.batchCounter();
    const pendingCount = await intentCollector.getPendingIntentsCount();
    const currentBatchStartTime = await intentCollector.currentBatchStartTime();
    
    // 获取常量
    const MIN_BATCH_SIZE = await intentCollector.MIN_BATCH_SIZE();
    const MAX_BATCH_SIZE = await intentCollector.MAX_BATCH_SIZE();
    const BATCH_TIMEOUT = await intentCollector.BATCH_TIMEOUT();
    
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceStart = currentTime - Number(currentBatchStartTime);
    
    console.log("📊 Current Batch Status:");
    console.log(`├── Batch Counter: ${batchCounter.toString()}`);
    console.log(`├── Pending Count: ${pendingCount.toString()}`);
    console.log(`├── Intent IDs Length: ${intentIds.length}`);
    console.log(`├── Is Ready: ${isReady}`);
    console.log("");
    
    console.log("⏰ Timing Information:");
    console.log(`├── Current Time: ${new Date(currentTime * 1000).toLocaleString()}`);
    console.log(`├── Batch Start Time: ${new Date(Number(currentBatchStartTime) * 1000).toLocaleString()}`);
    console.log(`├── Time Since Start: ${timeSinceStart} seconds`);
    console.log(`├── Batch Timeout: ${BATCH_TIMEOUT.toString()} seconds`);
    console.log(`├── Time Remaining: ${Math.max(0, Number(BATCH_TIMEOUT) - timeSinceStart)} seconds`);
    console.log("");
    
    console.log("🔍 Batch Ready Logic Analysis:");
    console.log(`├── MIN_BATCH_SIZE: ${MIN_BATCH_SIZE.toString()}`);
    console.log(`├── MAX_BATCH_SIZE: ${MAX_BATCH_SIZE.toString()}`);
    console.log(`├── Current Pending: ${pendingCount.toString()}`);
    console.log("");
    
    console.log("📋 Condition Checks:");
    const hasMaxSize = Number(pendingCount) >= Number(MAX_BATCH_SIZE);
    const hasMinSize = Number(pendingCount) >= Number(MIN_BATCH_SIZE);
    const timeoutElapsed = timeSinceStart >= Number(BATCH_TIMEOUT);
    
    console.log(`├── pendingCount >= MAX_BATCH_SIZE: ${pendingCount} >= ${MAX_BATCH_SIZE} = ${hasMaxSize}`);
    console.log(`├── pendingCount >= MIN_BATCH_SIZE: ${pendingCount} >= ${MIN_BATCH_SIZE} = ${hasMinSize}`);
    console.log(`├── timeout elapsed: ${timeSinceStart} >= ${BATCH_TIMEOUT} = ${timeoutElapsed}`);
    console.log("");
    
    const isReadyCondition1 = hasMaxSize;
    const isReadyCondition2 = hasMinSize && timeoutElapsed;
    const shouldBeReady = isReadyCondition1 || isReadyCondition2;
    
    console.log("🎯 Final Logic:");
    console.log(`├── Condition 1 (max size): ${isReadyCondition1}`);
    console.log(`├── Condition 2 (min size + timeout): ${isReadyCondition2}`);
    console.log(`├── Should be ready: ${shouldBeReady}`);
    console.log(`├── Actually is ready: ${isReady}`);
    console.log(`└── Logic consistent: ${shouldBeReady === isReady ? 'YES' : 'NO'}`);
    console.log("");
    
    // 现在检查 checkUpkeep 在这种情况下的行为
    console.log("🔧 CheckUpkeep Analysis:");
    
    if (isReady && intentIds.length === 0) {
      console.log("🚨 POTENTIAL BUG SCENARIO:");
      console.log("├── Batch is marked as 'ready'");
      console.log("├── But intentIds array is empty");
      console.log("├── This could happen if:");
      console.log("│   ├── 1. Timeout elapsed with 0 intents");
      console.log("│   ├── 2. All intents were removed/processed");
      console.log("│   └── 3. State inconsistency");
      console.log("");
      
      // 检查实际的 checkUpkeep
      const abiCoder = new ethers.AbiCoder();
      const checkData = abiCoder.encode(['uint256', 'uint256'], [5, 7200]);
      const result = await batchProcessor.checkUpkeep(checkData);
      
      console.log("🧪 Actual CheckUpkeep Result:");
      console.log(`├── upkeepNeeded: ${result.upkeepNeeded}`);
      console.log(`├── Expected: false (because intentIds.length = 0 < minBatchSize = 5)`);
      console.log(`└── Correct: ${result.upkeepNeeded === false ? 'YES' : 'NO'}`);
      
    } else if (!isReady) {
      console.log("✅ Normal scenario: Batch not ready");
      console.log("├── Either not enough intents or timeout not elapsed");
      console.log("└── checkUpkeep should return false");
      
    } else {
      console.log("🔍 Batch ready with intents:");
      console.log(`├── Intent count: ${intentIds.length}`);
      console.log("└── This would trigger checkUpkeep validation");
    }
    
    // 检查是否有历史的空批次处理
    console.log("");
    console.log("📈 Historical Analysis:");
    const lastProcessedBatch = await batchProcessor.lastProcessedBatch();
    console.log(`├── Last Processed Batch: ${lastProcessedBatch.toString()}`);
    
    if (Number(lastProcessedBatch) > 0) {
      try {
        const batchResult = await batchProcessor.getBatchResult(lastProcessedBatch);
        console.log(`├── Last Batch Participant Count: ${batchResult.participantCount.toString()}`);
        console.log(`├── Last Batch Total Amount In: ${batchResult.totalAmountIn.toString()}`);
        console.log(`├── Last Batch Success: ${batchResult.success}`);
        
        if (batchResult.participantCount === 0n || batchResult.totalAmountIn === 0n) {
          console.log("└── ⚠️  Last batch had no participants or zero amount!");
        }
      } catch (e) {
        console.log(`├── Could not get last batch result: ${e.message}`);
      }
    } else {
      console.log("└── No batches processed yet");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkTimingWindow().catch(console.error);