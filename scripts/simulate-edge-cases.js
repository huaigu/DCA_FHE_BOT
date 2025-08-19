#!/usr/bin/env node

const { ethers } = require("hardhat");

async function simulateEdgeCases() {
  console.log("🧪 CheckUpkeep Edge Case Simulation");
  console.log("===================================");
  
  const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
  
  try {
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
    const abiCoder = new ethers.AbiCoder();
    
    console.log("🎯 Testing Different CheckData Scenarios:");
    console.log("========================================");
    
    // Scenario 1: Standard checkData (5, 7200)
    console.log("\n📋 Scenario 1: Standard CheckData (minBatchSize=5, maxPriceAge=7200)");
    const checkData1 = abiCoder.encode(['uint256', 'uint256'], [5, 7200]);
    const result1 = await batchProcessor.checkUpkeep(checkData1);
    console.log(`├── CheckData: ${checkData1}`);
    console.log(`├── upkeepNeeded: ${result1.upkeepNeeded}`);
    console.log(`└── performData: ${result1.performData}`);
    
    // Scenario 2: Lower minBatchSize (0, 7200)
    console.log("\n📋 Scenario 2: Zero MinBatchSize (minBatchSize=0, maxPriceAge=7200)");
    const checkData2 = abiCoder.encode(['uint256', 'uint256'], [0, 7200]);
    const result2 = await batchProcessor.checkUpkeep(checkData2);
    console.log(`├── CheckData: ${checkData2}`);
    console.log(`├── upkeepNeeded: ${result2.upkeepNeeded}`);
    console.log(`└── performData: ${result2.performData}`);
    
    // Scenario 3: minBatchSize=1
    console.log("\n📋 Scenario 3: Minimal MinBatchSize (minBatchSize=1, maxPriceAge=7200)");
    const checkData3 = abiCoder.encode(['uint256', 'uint256'], [1, 7200]);
    const result3 = await batchProcessor.checkUpkeep(checkData3);
    console.log(`├── CheckData: ${checkData3}`);
    console.log(`├── upkeepNeeded: ${result3.upkeepNeeded}`);
    console.log(`└── performData: ${result3.performData}`);
    
    // Scenario 4: Empty checkData
    console.log("\n📋 Scenario 4: Empty CheckData (uses defaults)");
    const checkData4 = "0x";
    const result4 = await batchProcessor.checkUpkeep(checkData4);
    console.log(`├── CheckData: ${checkData4}`);
    console.log(`├── upkeepNeeded: ${result4.upkeepNeeded}`);
    console.log(`└── performData: ${result4.performData}`);
    
    // Scenario 5: Invalid checkData (should use defaults)
    console.log("\n📋 Scenario 5: Invalid CheckData (should fallback to defaults)");
    const checkData5 = "0x1234"; // Invalid data
    const result5 = await batchProcessor.checkUpkeep(checkData5);
    console.log(`├── CheckData: ${checkData5}`);
    console.log(`├── upkeepNeeded: ${result5.upkeepNeeded}`);
    console.log(`└── performData: ${result5.performData}`);
    
    // 现在检查系统在不同 minBatchSize 下的行为
    const intentCollectorAddress = await batchProcessor.intentCollector();
    const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorAddress);
    const [isReady, batchId, intentIds] = await intentCollector.checkBatchReady();
    
    console.log("\n🔍 Analysis Results:");
    console.log("===================");
    console.log(`Current system state:`);
    console.log(`├── isReady: ${isReady}`);
    console.log(`├── batchId: ${batchId.toString()}`);
    console.log(`├── intentIds.length: ${intentIds.length}`);
    console.log("");
    
    // 分析哪些场景会导致问题
    console.log("💡 Key Findings:");
    
    const anyUpkeepNeeded = [result1, result2, result3, result4, result5].some(r => r.upkeepNeeded);
    
    if (anyUpkeepNeeded) {
      console.log("🚨 POTENTIAL ISSUE FOUND:");
      console.log("├── Some checkData configurations return upkeepNeeded=true");
      console.log("├── Even when there are 0 intents available");
      console.log("└── This could explain the Chainlink automation trigger");
      
      [result1, result2, result3, result4, result5].forEach((result, i) => {
        if (result.upkeepNeeded) {
          console.log(`├── Scenario ${i + 1} triggers upkeep!`);
        }
      });
      
    } else {
      console.log("✅ ALL SCENARIOS CORRECTLY RETURN FALSE:");
      console.log("├── checkUpkeep logic appears to be working correctly");
      console.log("├── No edge case found that would cause false positives");
      console.log("└── The Chainlink trigger might be from a different cause");
    }
    
    // 检查是否有时间相关的边界情况
    console.log("\n⏰ Timing-Related Analysis:");
    console.log("===========================");
    
    // 模拟一个批次刚好在边界条件
    const currentTime = Math.floor(Date.now() / 1000);
    const batchStartTime = await intentCollector.currentBatchStartTime();
    const timeSinceStart = currentTime - Number(batchStartTime);
    const BATCH_TIMEOUT = await intentCollector.BATCH_TIMEOUT();
    
    console.log(`├── Time since batch start: ${timeSinceStart} seconds`);
    console.log(`├── Batch timeout: ${BATCH_TIMEOUT.toString()} seconds`);
    console.log(`├── Timeout exceeded: ${timeSinceStart > Number(BATCH_TIMEOUT) ? 'YES' : 'NO'}`);
    
    if (timeSinceStart > Number(BATCH_TIMEOUT) * 10) {
      console.log("├── ⚠️  Batch has been pending for a very long time");
      console.log("├── This might indicate a stale state issue");
      console.log("└── Consider restarting batch or clearing state");
    }

  } catch (error) {
    console.error("❌ Simulation Error:", error.message);
  }
}

simulateEdgeCases().catch(console.error);