#!/usr/bin/env node

const { ethers } = require("hardhat");

// Sepolia 上部署的 BatchProcessor 合约地址
const SEPOLIA_BATCH_PROCESSOR = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";

// 生成 checkData (5, 7200)
function generateCheckData() {
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(['uint256', 'uint256'], [5, 7200]);
}

async function queryCheckUpkeep() {
  const contractAddress = process.env.CONTRACT_ADDRESS || SEPOLIA_BATCH_PROCESSOR;
  const checkData = generateCheckData();
  
  console.log("🔍 BatchProcessor checkUpkeep Query");
  console.log("===================================");
  console.log(`📋 Contract: ${contractAddress}`);
  console.log(`🌐 Network: Sepolia`);
  console.log(`📊 CheckData: ${checkData}`);
  console.log(`📋 Decoded CheckData: minBatchSize=5, maxPriceAge=7200`);
  console.log("");

  try {
    // 连接合约
    const batchProcessor = await ethers.getContractAt("BatchProcessor", contractAddress);
    const [signer] = await ethers.getSigners();
    
    console.log(`👤 Querying from: ${signer.address}`);
    console.log("");

    // 查询基本状态
    console.log("🔧 System Status:");
    const automationEnabled = await batchProcessor.automationEnabled();
    const paused = await batchProcessor.paused();
    const lastProcessedBatch = await batchProcessor.lastProcessedBatch();
    
    console.log(`├── Automation Enabled: ${automationEnabled}`);
    console.log(`├── Paused: ${paused}`);
    console.log(`└── Last Processed Batch: ${lastProcessedBatch.toString()}`);
    console.log("");

    // 查询 IntentCollector 状态
    console.log("📝 Intent Collector Status:");
    const intentCollectorAddress = await batchProcessor.intentCollector();
    const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorAddress);
    
    console.log(`├── Intent Collector: ${intentCollectorAddress}`);
    
    try {
      const batchCounter = await intentCollector.batchCounter();
      console.log(`├── Current Batch ID: ${batchCounter.toString()}`);
      
      // 尝试获取更多批次信息
      try {
        const [currentBatch, pendingCount, timeRemaining] = await intentCollector.getCurrentBatchInfo();
        console.log(`├── Pending Intents: ${pendingCount.toString()}`);
        console.log(`├── Time Remaining: ${timeRemaining.toString()}s`);
      } catch (infoError) {
        console.log(`├── Additional Info: Not available`);
      }
    } catch (error) {
      console.log(`├── Batch Counter Error: ${error.message}`);
    }
    
    // 检查批次状态
    try {
      const [isReady, batchId, intentIds] = await intentCollector.checkBatchReady();
      console.log(`├── Batch Ready: ${isReady}`);
      console.log(`├── Ready Batch ID: ${batchId.toString()}`);
      console.log(`└── Intent Count: ${intentIds.length}`);
    } catch (error) {
      console.log(`└── Batch Check Error: ${error.message}`);
    }
    console.log("");

    // 查询价格 Feed 状态
    console.log("💰 Price Feed Status:");
    const priceFeedAddress = await batchProcessor.priceFeed();
    const priceFeed = await ethers.getContractAt("IChainlinkAggregator", priceFeedAddress);
    
    console.log(`├── Price Feed: ${priceFeedAddress}`);
    
    try {
      const [roundId, price, startedAt, updatedAt, answeredInRound] = await priceFeed.latestRoundData();
      const now = Math.floor(Date.now() / 1000);
      const ageSeconds = now - Number(updatedAt);
      const priceInCents = Number(price) / 1e6; // Convert from 8 decimals to cents
      
      console.log(`├── Latest Price: $${priceInCents.toFixed(2)} (${price.toString()} raw)`);
      console.log(`├── Updated At: ${new Date(Number(updatedAt) * 1000).toLocaleString()}`);
      console.log(`├── Price Age: ${ageSeconds} seconds`);
      console.log(`├── Round ID: ${roundId.toString()}`);
      console.log(`└── Is Fresh: ${ageSeconds < 7200 ? 'Yes' : 'No'} (< 7200s threshold)`);
    } catch (error) {
      console.log(`└── Price Feed Error: ${error.message}`);
    }
    console.log("");

    // 执行 checkUpkeep 查询
    console.log("🎯 CheckUpkeep Query:");
    console.log("────────────────────");
    
    const startTime = Date.now();
    const result = await batchProcessor.checkUpkeep(checkData);
    const queryTime = Date.now() - startTime;
    
    console.log(`⏱️  Query Time: ${queryTime}ms`);
    console.log(`📤 Result:`);
    console.log(`├── upkeepNeeded: ${result.upkeepNeeded}`);
    console.log(`├── performData: ${result.performData}`);
    console.log(`└── performData Length: ${result.performData.length} characters`);
    console.log("");

    // 解析 performData (如果存在)
    if (result.performData && result.performData !== "0x") {
      console.log("🔍 PerformData Analysis:");
      console.log("────────────────────────");
      
      try {
        // 尝试解码 performData
        const abiCoder = new ethers.AbiCoder();
        const decoded = abiCoder.decode(['uint256', 'uint256[]', 'uint256'], result.performData);
        
        console.log(`├── Batch ID: ${decoded[0].toString()}`);
        console.log(`├── Intent IDs: [${decoded[1].map(id => id.toString()).join(', ')}]`);
        console.log(`├── Intent Count: ${decoded[1].length}`);
        console.log(`└── Min Batch Size: ${decoded[2].toString()}`);
      } catch (decodeError) {
        // 尝试旧格式
        try {
          const decodedOld = abiCoder.decode(['uint256', 'uint256[]'], result.performData);
          console.log(`├── Batch ID (old format): ${decodedOld[0].toString()}`);
          console.log(`├── Intent IDs: [${decodedOld[1].map(id => id.toString()).join(', ')}]`);
          console.log(`├── Intent Count: ${decodedOld[1].length}`);
          console.log(`└── Format: Legacy (no minBatchSize)`);
        } catch (oldDecodeError) {
          console.log(`└── Decode Error: ${decodeError.message}`);
        }
      }
      console.log("");
    }

    // 总结
    console.log("📋 Summary:");
    console.log("─────────");
    if (result.upkeepNeeded) {
      console.log("✅ Upkeep is NEEDED - Chainlink will trigger performUpkeep");
      console.log("🚀 BatchProcessor is ready to process a batch");
    } else {
      console.log("❌ Upkeep is NOT needed - No action will be taken");
      console.log("⏳ Waiting for conditions to be met");
    }

  } catch (error) {
    console.error("❌ Error querying checkUpkeep:", error.message);
    if (error.message.includes("execution reverted")) {
      console.log("💡 The contract might be in an invalid state or paused");
    }
  }
}

// 显示使用说明
function showUsage() {
  console.log("📖 Usage Examples:");
  console.log("");
  console.log("# Query checkUpkeep (默认 Sepolia 地址):");
  console.log("npx hardhat run scripts/query-checkupkeep.js --network sepolia");
  console.log("");
  console.log("# 使用自定义合约地址:");
  console.log("CONTRACT_ADDRESS=0xYourAddress npx hardhat run scripts/query-checkupkeep.js --network sepolia");
  console.log("");
  console.log("📋 Default Contract: " + SEPOLIA_BATCH_PROCESSOR);
  console.log("📊 CheckData: minBatchSize=5, maxPriceAge=7200 seconds");
}

// 检查是否显示帮助
if (process.env.HELP === 'true') {
  showUsage();
} else {
  queryCheckUpkeep().catch(console.error);
}