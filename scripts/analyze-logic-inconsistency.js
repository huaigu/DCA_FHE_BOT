#!/usr/bin/env node

const { ethers } = require("hardhat");

async function analyzeLogicInconsistency() {
  console.log("🚨 Logic Inconsistency Analysis");
  console.log("==============================");
  
  console.log("📋 Problem Identified:");
  console.log("├── IntentCollector._isBatchReady() uses HARDCODED constants:");
  console.log("│   ├── MIN_BATCH_SIZE = 5 (constant)");
  console.log("│   └── MAX_BATCH_SIZE = 10 (constant)");
  console.log("├── BatchProcessor.checkUpkeep() uses DYNAMIC parameters:");
  console.log("│   ├── minBatchSize from checkData (default: 5)");
  console.log("│   └── Can be configured to any value 1-50");
  console.log("└── This creates a FUNDAMENTAL MISMATCH!");
  console.log("");

  try {
    const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
    const intentCollectorAddress = await batchProcessor.intentCollector();
    const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorAddress);

    // 获取 IntentCollector 的常量
    const MIN_BATCH_SIZE = await intentCollector.MIN_BATCH_SIZE();
    const MAX_BATCH_SIZE = await intentCollector.MAX_BATCH_SIZE();
    const BATCH_TIMEOUT = await intentCollector.BATCH_TIMEOUT();

    console.log("🔍 Current System Constants:");
    console.log(`├── IntentCollector.MIN_BATCH_SIZE: ${MIN_BATCH_SIZE.toString()}`);
    console.log(`├── IntentCollector.MAX_BATCH_SIZE: ${MAX_BATCH_SIZE.toString()}`);
    console.log(`└── IntentCollector.BATCH_TIMEOUT: ${BATCH_TIMEOUT.toString()}`);
    console.log("");

    // 测试不同的 checkData 配置
    console.log("🧪 Testing Logic Mismatch Scenarios:");
    console.log("====================================");

    const abiCoder = new ethers.AbiCoder();

    // Scenario 1: checkData minBatchSize < IntentCollector.MIN_BATCH_SIZE
    console.log("\n📋 Scenario 1: checkData minBatchSize = 3 (< IntentCollector.MIN_BATCH_SIZE = 5)");
    const checkData1 = abiCoder.encode(['uint256', 'uint256'], [3, 7200]);
    
    console.log("├── If pendingIntents.length = 4:");
    console.log("│   ├── IntentCollector._isBatchReady(): 4 >= 5 = false");
    console.log("│   ├── BatchProcessor.checkUpkeep(): 4 >= 3 = true");
    console.log("│   └── MISMATCH: checkUpkeep would return false because isReady = false");
    console.log("");

    // Scenario 2: checkData minBatchSize > IntentCollector.MIN_BATCH_SIZE
    console.log("📋 Scenario 2: checkData minBatchSize = 8 (> IntentCollector.MIN_BATCH_SIZE = 5)");
    const checkData2 = abiCoder.encode(['uint256', 'uint256'], [8, 7200]);
    
    console.log("├── If pendingIntents.length = 6:");
    console.log("│   ├── IntentCollector._isBatchReady(): 6 >= 5 = true");
    console.log("│   ├── BatchProcessor.checkUpkeep(): isReady=true AND 6 >= 8 = false");
    console.log("│   └── MISMATCH: checkUpkeep would return false despite batch being ready");
    console.log("");

    // 实际测试当前状态
    console.log("🔧 Current System State Test:");
    console.log("=============================");

    const [isReady, batchId, intentIds] = await intentCollector.checkBatchReady();
    const pendingCount = await intentCollector.getPendingIntentsCount();

    console.log(`├── Current pendingIntents.length: ${pendingCount.toString()}`);
    console.log(`├── Current intentIds.length: ${intentIds.length}`);
    console.log(`├── IntentCollector.isReady: ${isReady}`);
    console.log("");

    // 测试不同的 minBatchSize
    for (const minBatch of [1, 3, 5, 8, 10]) {
      const checkData = abiCoder.encode(['uint256', 'uint256'], [minBatch, 7200]);
      const result = await batchProcessor.checkUpkeep(checkData);
      
      const willPass = isReady && batchId > 0 && intentIds.length >= minBatch;
      console.log(`├── minBatchSize=${minBatch}: checkUpkeep=${result.upkeepNeeded}, expected=${willPass ? 'true' : 'false'}`);
    }

    console.log("");

    // 分析潜在的问题场景
    console.log("🚨 Potential Problem Scenarios:");
    console.log("===============================");

    console.log("📋 Scenario A: False Positive Triggers");
    console.log("├── Condition: pendingIntents.length between MIN_BATCH_SIZE and checkData.minBatchSize");
    console.log("├── Example: 6 intents, IntentCollector.MIN_BATCH_SIZE=5, checkData.minBatchSize=8");
    console.log("├── Result: IntentCollector says ready, but BatchProcessor rejects");
    console.log("└── Impact: Wasted gas, failed performUpkeep calls");
    console.log("");

    console.log("📋 Scenario B: False Negative (Missed Triggers)");
    console.log("├── Condition: checkData.minBatchSize < IntentCollector.MIN_BATCH_SIZE");
    console.log("├── Example: 4 intents, IntentCollector.MIN_BATCH_SIZE=5, checkData.minBatchSize=3");
    console.log("├── Result: IntentCollector says not ready, BatchProcessor never checks");
    console.log("└── Impact: Batches never process despite having enough intents per checkData");
    console.log("");

    console.log("📋 Scenario C: Timeout-based Edge Case");
    console.log("├── Condition: Timeout elapsed but intent count between the two thresholds");
    console.log("├── IntentCollector: (pendingCount >= MIN_BATCH_SIZE && timeout) = ready");
    console.log("├── BatchProcessor: (isReady && pendingCount >= checkData.minBatchSize) = check further");
    console.log("└── Impact: Depends on the relative values of the two thresholds");

    console.log("");
    console.log("💡 Root Cause Analysis:");
    console.log("=======================");
    console.log("├── IntentCollector uses FIXED constants for batch readiness");
    console.log("├── BatchProcessor uses DYNAMIC parameters from checkData");
    console.log("├── These two systems are NOT synchronized");
    console.log("├── This can cause false positives AND false negatives");
    console.log("└── The issue becomes worse with different Chainlink configurations");

    console.log("");
    console.log("🔧 Recommended Solutions:");
    console.log("=========================");
    console.log("├── Option 1: Make IntentCollector.MIN_BATCH_SIZE configurable");
    console.log("│   ├── Add setMinBatchSize() function");
    console.log("│   └── Sync with BatchProcessor checkData");
    console.log("├── Option 2: Remove batch size check from BatchProcessor");
    console.log("│   ├── Trust IntentCollector's batch readiness completely");
    console.log("│   └── Only validate price and other conditions");
    console.log("├── Option 3: Pass checkData minBatchSize to IntentCollector");
    console.log("│   ├── Modify checkBatchReady() to accept minBatchSize parameter");
    console.log("│   └── Make batch readiness dependent on the actual requirement");
    console.log("└── Option 4: Use max() of both values for safety");

  } catch (error) {
    console.error("❌ Analysis Error:", error.message);
  }
}

analyzeLogicInconsistency().catch(console.error);