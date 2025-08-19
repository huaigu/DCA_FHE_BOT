#!/usr/bin/env node

const { ethers } = require("hardhat");

// 分析特定交易
async function analyzeTransaction() {
  const txHash = "0x9930fd4c281901c1c5a606d754a71197e6f89bb23b27b13acd76337f31853f23";
  
  console.log("🔍 Chainlink Automation Transaction Analysis");
  console.log("===========================================");
  console.log(`📋 Transaction: ${txHash}`);
  console.log("");

  try {
    // 获取交易详情
    const tx = await ethers.provider.getTransaction(txHash);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    if (!tx || !receipt) {
      console.log("❌ Transaction not found");
      return;
    }

    console.log("📊 Transaction Details:");
    console.log(`├── From: ${tx.from}`);
    console.log(`├── To: ${tx.to}`);
    console.log(`├── Block: ${tx.blockNumber}`);
    console.log(`├── Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`├── Gas Price: ${tx.gasPrice.toString()}`);
    console.log(`├── Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    console.log(`└── Timestamp: ${new Date((await ethers.provider.getBlock(tx.blockNumber)).timestamp * 1000).toLocaleString()}`);
    console.log("");

    // 检查是否是 BatchProcessor 交易
    const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
    
    if (tx.to?.toLowerCase() === batchProcessorAddress.toLowerCase()) {
      console.log("✅ This is a BatchProcessor transaction");
      
      // 解析交易数据
      const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
      const iface = batchProcessor.interface;
      
      try {
        const decodedData = iface.parseTransaction({ data: tx.data });
        console.log(`📝 Function Called: ${decodedData.name}`);
        
        if (decodedData.name === 'performUpkeep') {
          console.log("🎯 This is a performUpkeep call!");
          console.log(`├── performData: ${decodedData.args[0]}`);
          
          // 尝试解析 performData
          try {
            const abiCoder = new ethers.AbiCoder();
            const decoded = abiCoder.decode(['uint256', 'uint256[]', 'uint256'], decodedData.args[0]);
            console.log(`├── Batch ID: ${decoded[0].toString()}`);
            console.log(`├── Intent IDs: [${decoded[1].map(id => id.toString()).join(', ')}]`);
            console.log(`├── Intent Count: ${decoded[1].length}`);
            console.log(`└── Min Batch Size: ${decoded[2].toString()}`);
          } catch (decodeError) {
            try {
              const decodedOld = abiCoder.decode(['uint256', 'uint256[]'], decodedData.args[0]);
              console.log(`├── Batch ID (old format): ${decodedOld[0].toString()}`);
              console.log(`├── Intent IDs: [${decodedOld[1].map(id => id.toString()).join(', ')}]`);
              console.log(`└── Intent Count: ${decodedOld[1].length}`);
            } catch (oldDecodeError) {
              console.log(`└── Decode Error: ${decodeError.message}`);
            }
          }
        }
        
      } catch (parseError) {
        console.log(`❌ Failed to parse transaction data: ${parseError.message}`);
      }
    } else {
      console.log("❌ This is NOT a BatchProcessor transaction");
      console.log(`Expected: ${batchProcessorAddress}`);
      console.log(`Actual: ${tx.to}`);
    }
    
    console.log("");

    // 分析交易日志
    console.log("📋 Transaction Logs:");
    if (receipt.logs.length === 0) {
      console.log("└── No logs found");
    } else {
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`├── Log ${i + 1}:`);
        console.log(`│   ├── Address: ${log.address}`);
        console.log(`│   ├── Topics: ${log.topics.length}`);
        console.log(`│   └── Data: ${log.data.substring(0, 50)}...`);
        
        // 尝试解析已知事件
        if (log.address.toLowerCase() === batchProcessorAddress.toLowerCase()) {
          try {
            const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
            const parsedLog = batchProcessor.interface.parseLog(log);
            console.log(`│   └── Event: ${parsedLog.name}`);
            if (parsedLog.name === "AutomationTriggered") {
              console.log(`│       ├── Batch ID: ${parsedLog.args.batchId.toString()}`);
              console.log(`│       └── Reason: ${parsedLog.args.reason}`);
            }
          } catch (parseError) {
            // 无法解析的日志
          }
        }
      }
    }
    
    console.log("");

    // 检查交易时间点的系统状态
    console.log("🕐 Transaction Time Analysis:");
    const block = await ethers.provider.getBlock(tx.blockNumber);
    const txTimestamp = block.timestamp;
    console.log(`├── Transaction Time: ${new Date(txTimestamp * 1000).toLocaleString()}`);
    console.log(`├── Block Number: ${tx.blockNumber}`);
    
    // 现在检查当前的 checkUpkeep 状态进行对比
    console.log("├── Current checkUpkeep Status (for comparison):");
    
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
    const abiCoder = new ethers.AbiCoder();
    const checkData = abiCoder.encode(['uint256', 'uint256'], [5, 7200]);
    
    const result = await batchProcessor.checkUpkeep(checkData);
    console.log(`└── Current upkeepNeeded: ${result.upkeepNeeded}`);
    
  } catch (error) {
    console.error("❌ Error analyzing transaction:", error.message);
  }
}

// 检查时间差异
async function checkTimingIssue() {
  console.log("\n🔍 Potential Timing Issues:");
  console.log("===========================");
  
  const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
  const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
  
  // 检查自动化配置
  const automationEnabled = await batchProcessor.automationEnabled();
  const paused = await batchProcessor.paused();
  
  console.log(`├── Automation Enabled: ${automationEnabled}`);
  console.log(`├── Paused: ${paused}`);
  
  // 检查 Intent Collector
  const intentCollectorAddress = await batchProcessor.intentCollector();
  const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorAddress);
  
  const [isReady, batchId, intentIds] = await intentCollector.checkBatchReady();
  console.log(`├── Batch Ready: ${isReady}`);
  console.log(`├── Intent Count: ${intentIds.length}`);
  
  console.log("\n💡 Possible Explanations:");
  console.log("├── 1. State changed between checkUpkeep and performUpkeep");
  console.log("├── 2. Chainlink used different checkData parameters");
  console.log("├── 3. Transaction was queued before state change");
  console.log("├── 4. Network latency/timing issues");
  console.log("└── 5. Chainlink automation bug or misconfiguration");
}

// 主函数
async function main() {
  await analyzeTransaction();
  await checkTimingIssue();
}

main().catch(console.error);