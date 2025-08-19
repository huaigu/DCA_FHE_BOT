#!/usr/bin/env node

const { ethers } = require("hardhat");

async function analyzeCheckUpkeepLogic() {
  console.log("🔍 CheckUpkeep Logic Deep Analysis");
  console.log("==================================");
  
  const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
  const keeperRegistryAddress = "0x86EFBD0b6736Bed994962f9797049422A3A8E8Ad";
  
  console.log("📋 Key Discovery:");
  console.log(`├── Target Address: ${keeperRegistryAddress}`);
  console.log("├── This IS Chainlink KeeperRegistry!");
  console.log("├── Registry calls YOUR contract's checkUpkeep");
  console.log(`├── Your BatchProcessor: ${batchProcessorAddress}`);
  console.log("└── So the issue IS with your checkUpkeep logic");
  console.log("");

  try {
    // 1. 分析当前系统状态
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
    const intentCollectorAddress = await batchProcessor.intentCollector();
    const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorAddress);
    
    console.log("🔧 Current System State:");
    const automationEnabled = await batchProcessor.automationEnabled();
    const paused = await batchProcessor.paused();
    const lastProcessedBatch = await batchProcessor.lastProcessedBatch();
    
    console.log(`├── Automation Enabled: ${automationEnabled}`);
    console.log(`├── Paused: ${paused}`);
    console.log(`└── Last Processed Batch: ${lastProcessedBatch.toString()}`);
    console.log("");

    // 2. 详细分析 checkBatchReady 的返回值
    console.log("📊 IntentCollector Analysis:");
    console.log(`├── IntentCollector: ${intentCollectorAddress}`);
    
    const [isReady, batchId, intentIds] = await intentCollector.checkBatchReady();
    console.log(`├── isReady: ${isReady}`);
    console.log(`├── batchId: ${batchId.toString()}`);
    console.log(`├── intentIds.length: ${intentIds.length}`);
    console.log(`├── intentIds: [${intentIds.map(id => id.toString()).join(', ')}]`);
    console.log("");

    // 3. 模拟 checkUpkeep 逻辑步骤
    console.log("🎯 CheckUpkeep Logic Simulation:");
    console.log("=================================");
    
    // Step 1: Basic state checks
    console.log("Step 1: Basic State Checks");
    const step1Pass = automationEnabled && !paused;
    console.log(`├── automationEnabled: ${automationEnabled}`);
    console.log(`├── !paused: ${!paused}`);
    console.log(`└── Step 1 Result: ${step1Pass ? 'PASS' : 'FAIL'}`);
    console.log("");
    
    if (!step1Pass) {
      console.log("❌ Stopped at Step 1 - Basic checks failed");
      return;
    }

    // Step 2: Parse checkData
    console.log("Step 2: Parse CheckData");
    const abiCoder = new ethers.AbiCoder();
    const checkData = abiCoder.encode(['uint256', 'uint256'], [5, 7200]);
    console.log(`├── checkData: ${checkData}`);
    console.log(`├── Default minBatchSize: 5`);
    console.log(`├── Default maxPriceAge: 7200`);
    
    let minBatchSize = 5;
    let maxPriceAge = 7200;
    
    try {
      const decoded = abiCoder.decode(['uint256', 'uint256'], checkData);
      if (decoded[0] > 0 && decoded[0] <= 50) {
        minBatchSize = Number(decoded[0]);
      }
      if (decoded[1] > 0 && decoded[1] <= 7200) {
        maxPriceAge = Number(decoded[1]);
      }
      console.log(`├── Parsed minBatchSize: ${minBatchSize}`);
      console.log(`└── Parsed maxPriceAge: ${maxPriceAge}`);
    } catch (e) {
      console.log(`└── CheckData parsing failed, using defaults`);
    }
    console.log("");

    // Step 3: Check batch ready condition
    console.log("Step 3: Batch Ready Condition");
    console.log(`├── isReady: ${isReady}`);
    console.log(`├── batchId > lastProcessedBatch: ${batchId} > ${lastProcessedBatch} = ${batchId > lastProcessedBatch}`);
    console.log(`├── intentIds.length >= minBatchSize: ${intentIds.length} >= ${minBatchSize} = ${intentIds.length >= minBatchSize}`);
    
    const step3Condition = isReady && batchId > lastProcessedBatch && intentIds.length >= minBatchSize;
    console.log(`└── Step 3 Result: ${step3Condition ? 'PASS' : 'FAIL'}`);
    console.log("");
    
    if (!step3Condition) {
      console.log("✅ Correctly stopped at Step 3 - Batch not ready");
      console.log(`├── Reason: ${!isReady ? 'Batch not ready' : 
                                   batchId <= lastProcessedBatch ? 'Already processed' : 
                                   'Not enough intents'}`);
      console.log("└── checkUpkeep should return false");
      console.log("");
    } else {
      console.log("⚠️  Step 3 PASSED - Continuing to price check");
      
      // Step 4: Price validation
      console.log("Step 4: Price Validation");
      const priceFeedAddress = await batchProcessor.priceFeed();
      const priceFeed = await ethers.getContractAt("IChainlinkAggregator", priceFeedAddress);
      
      try {
        const [roundId, price, startedAt, updatedAt, answeredInRound] = await priceFeed.latestRoundData();
        const currentTime = Math.floor(Date.now() / 1000);
        const priceAge = currentTime - Number(updatedAt);
        
        console.log(`├── Price: ${price.toString()}`);
        console.log(`├── Updated At: ${new Date(Number(updatedAt) * 1000).toLocaleString()}`);
        console.log(`├── Price Age: ${priceAge} seconds`);
        console.log(`├── Max Age Allowed: ${maxPriceAge} seconds`);
        console.log(`├── price > 0: ${price > 0}`);
        console.log(`├── updatedAt fresh: ${priceAge < maxPriceAge}`);
        
        const priceValid = price > 0 && priceAge < maxPriceAge;
        console.log(`└── Price Valid: ${priceValid}`);
        
        if (priceValid) {
          console.log("");
          console.log("🚨 CRITICAL ISSUE IDENTIFIED:");
          console.log("============================");
          console.log("❌ checkUpkeep would return TRUE!");
          console.log(`├── All conditions are met:`);
          console.log(`│   ├── Automation enabled: ${automationEnabled}`);
          console.log(`│   ├── Not paused: ${!paused}`);
          console.log(`│   ├── Batch ready: ${isReady}`);
          console.log(`│   ├── New batch: ${batchId > lastProcessedBatch}`);
          console.log(`│   ├── Enough intents: ${intentIds.length} >= ${minBatchSize}`);
          console.log(`│   └── Price fresh: ${priceAge} < ${maxPriceAge}`);
          console.log("└── But there are actually 0 intents!");
          console.log("");
          console.log("🔍 THE BUG:");
          console.log("├── checkBatchReady() returns isReady=true with empty intentIds[]");
          console.log("├── checkUpkeep only checks intentIds.length >= minBatchSize"); 
          console.log("├── But doesn't verify if intents actually exist or are valid");
          console.log("└── This causes false positive upkeep triggers");
        }
        
      } catch (priceError) {
        console.log(`└── Price check failed: ${priceError.message}`);
      }
    }

    // 4. 实际调用 checkUpkeep 验证
    console.log("🧪 Actual CheckUpkeep Call:");
    console.log("===========================");
    
    const result = await batchProcessor.checkUpkeep(checkData);
    console.log(`├── Actual upkeepNeeded: ${result.upkeepNeeded}`);
    console.log(`├── Actual performData: ${result.performData}`);
    console.log(`└── PerformData length: ${result.performData.length}`);
    
    if (result.upkeepNeeded && intentIds.length === 0) {
      console.log("");
      console.log("🚨 BUG CONFIRMED:");
      console.log("=================");
      console.log("❌ checkUpkeep returns TRUE with 0 intents!");
      console.log("├── This explains why Chainlink triggered performUpkeep");
      console.log("├── performUpkeep would then fail or process empty batch");
      console.log("└── Logic needs to be fixed in checkUpkeep function");
    } else if (!result.upkeepNeeded) {
      console.log("");
      console.log("✅ Current behavior is correct");
      console.log("└── checkUpkeep correctly returns false");
    }

  } catch (error) {
    console.error("❌ Analysis Error:", error.message);
  }
}

analyzeCheckUpkeepLogic().catch(console.error);