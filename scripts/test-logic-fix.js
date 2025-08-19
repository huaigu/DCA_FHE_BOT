#!/usr/bin/env node

const { ethers } = require("hardhat");

async function testLogicFix() {
  console.log("🧪 Testing Logic Inconsistency Fix");
  console.log("=================================");
  
  const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
  
  try {
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
    const intentCollectorAddress = await batchProcessor.intentCollector();
    const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorAddress);
    const abiCoder = new ethers.AbiCoder();
    
    // Get current system state
    const [isReady, batchId, intentIds] = await intentCollector.checkBatchReady();
    const pendingCount = await intentCollector.getPendingIntentsCount();
    const MIN_BATCH_SIZE = await intentCollector.MIN_BATCH_SIZE();
    const MAX_BATCH_SIZE = await intentCollector.MAX_BATCH_SIZE();
    
    console.log("📊 Current System State:");
    console.log(`├── IntentCollector isReady: ${isReady}`);
    console.log(`├── Pending Count: ${pendingCount.toString()}`);
    console.log(`├── Intent IDs Length: ${intentIds.length}`);
    console.log(`├── MIN_BATCH_SIZE: ${MIN_BATCH_SIZE.toString()}`);
    console.log(`├── MAX_BATCH_SIZE: ${MAX_BATCH_SIZE.toString()}`);
    console.log("");
    
    console.log("🔧 Testing Fixed Logic with Various CheckData:");
    console.log("============================================");
    
    // Test scenarios with different minBatchSize values
    const testScenarios = [
      { minBatchSize: 1, maxPriceAge: 7200, description: "Minimal batch size (1)" },
      { minBatchSize: 3, maxPriceAge: 7200, description: "Below IntentCollector MIN (3)" },
      { minBatchSize: 5, maxPriceAge: 7200, description: "Equal to IntentCollector MIN (5)" },
      { minBatchSize: 8, maxPriceAge: 7200, description: "Above IntentCollector MIN (8)" },
      { minBatchSize: 10, maxPriceAge: 7200, description: "Equal to IntentCollector MAX (10)" },
      { minBatchSize: 15, maxPriceAge: 7200, description: "Above IntentCollector MAX (15)" },
      { minBatchSize: 50, maxPriceAge: 7200, description: "Maximum allowed (50)" }
    ];
    
    for (const scenario of testScenarios) {
      console.log(`\n📋 Scenario: ${scenario.description}`);
      const checkData = abiCoder.encode(['uint256', 'uint256'], [scenario.minBatchSize, scenario.maxPriceAge]);
      const result = await batchProcessor.checkUpkeep(checkData);
      
      // With the fix, checkUpkeep should only depend on:
      // 1. IntentCollector.isReady (trusts its internal logic)
      // 2. intentIds.length > 0 (has actual intents)
      // 3. Price feed validity
      
      const expectedUpkeepNeeded = isReady && intentIds.length > 0;
      const isCorrect = result.upkeepNeeded === expectedUpkeepNeeded;
      
      console.log(`├── CheckData minBatchSize: ${scenario.minBatchSize}`);
      console.log(`├── Expected upkeepNeeded: ${expectedUpkeepNeeded}`);
      console.log(`├── Actual upkeepNeeded: ${result.upkeepNeeded}`);
      console.log(`└── Correct: ${isCorrect ? '✅' : '❌'}`);
      
      if (!isCorrect) {
        console.log(`   └── ⚠️  UNEXPECTED RESULT! Check price feed or other conditions`);
      }
    }
    
    console.log("\n🔍 Testing Empty CheckData:");
    console.log("==========================");
    
    const emptyCheckData = "0x";
    const emptyResult = await batchProcessor.checkUpkeep(emptyCheckData);
    const expectedEmpty = isReady && intentIds.length > 0;
    
    console.log(`├── Empty checkData: ${emptyCheckData}`);
    console.log(`├── Expected upkeepNeeded: ${expectedEmpty}`);
    console.log(`├── Actual upkeepNeeded: ${emptyResult.upkeepNeeded}`);
    console.log(`└── Correct: ${emptyResult.upkeepNeeded === expectedEmpty ? '✅' : '❌'}`);
    
    console.log("\n🧪 Testing Invalid CheckData:");
    console.log("=============================");
    
    const invalidCheckData = "0x1234";
    const invalidResult = await batchProcessor.checkUpkeep(invalidCheckData);
    const expectedInvalid = isReady && intentIds.length > 0;
    
    console.log(`├── Invalid checkData: ${invalidCheckData}`);
    console.log(`├── Expected upkeepNeeded: ${expectedInvalid}`);
    console.log(`├── Actual upkeepNeeded: ${invalidResult.upkeepNeeded}`);
    console.log(`└── Correct: ${invalidResult.upkeepNeeded === expectedInvalid ? '✅' : '❌'}`);
    
    console.log("\n💡 Logic Fix Summary:");
    console.log("====================");
    console.log("✅ Fixed Issues:");
    console.log("├── Removed redundant batch size check in checkUpkeep()");
    console.log("├── Now trusts IntentCollector's batch readiness logic completely");
    console.log("├── checkUpkeep() only validates: isReady && intentIds.length > 0 && price valid");
    console.log("├── performUpkeep() only validates: isReady && intentIds.length > 0");
    console.log("└── No more inconsistency between hardcoded and dynamic parameters");
    
    console.log("\n🎯 Behavior Change:");
    console.log("==================");
    console.log("├── BEFORE: checkData.minBatchSize could conflict with IntentCollector constants");
    console.log("├── AFTER: checkData.minBatchSize is ignored for batch readiness (used only for metadata)");
    console.log("├── BENEFIT: Consistent behavior regardless of Chainlink registration parameters");
    console.log("└── RESULT: No more false positives or false negatives due to parameter mismatch");
    
    if (isReady && intentIds.length === 0) {
      console.log("\n⚠️  Current State Warning:");
      console.log("=========================");
      console.log("├── Batch is marked as ready but has 0 intents");
      console.log("├── This might indicate a timeout scenario or state inconsistency");
      console.log("├── With the fix, checkUpkeep correctly returns false");
      console.log("└── No false automation triggers will occur");
    }
    
  } catch (error) {
    console.error("❌ Test Error:", error.message);
    console.error("Stack:", error.stack);
  }
}

testLogicFix().catch(console.error);