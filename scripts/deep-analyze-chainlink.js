#!/usr/bin/env node

const { ethers } = require("hardhat");

async function deepAnalyzeChainlinkIssue() {
  console.log("🔍 Deep Chainlink Automation Issue Analysis");
  console.log("==========================================");
  
  const txHash = "0x9930fd4c281901c1c5a606d754a71197e6f89bb23b27b13acd76337f31853f23";
  const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
  
  try {
    // 1. 获取问题交易的详细信息
    const tx = await ethers.provider.getTransaction(txHash);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("📋 Problem Transaction Details:");
    console.log(`├── Hash: ${txHash}`);
    console.log(`├── From: ${tx.from} (Chainlink Node)`);
    console.log(`├── To: ${tx.to}`);
    console.log(`├── Block: ${tx.blockNumber}`);
    console.log(`├── Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`├── Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    
    const block = await ethers.provider.getBlock(tx.blockNumber);
    console.log(`├── Timestamp: ${new Date(block.timestamp * 1000).toLocaleString()}`);
    console.log(`└── Data Length: ${tx.data.length} bytes`);
    console.log("");

    // 2. 检查这是否真的是 performUpkeep 调用
    const performUpkeepSelector = "0x4585e33b"; // keccak256("performUpkeep(bytes)")
    const methodId = tx.data.substring(0, 10);
    
    console.log("🎯 Method Analysis:");
    console.log(`├── Method ID: ${methodId}`);
    console.log(`├── Expected performUpkeep ID: ${performUpkeepSelector}`);
    console.log(`├── Is performUpkeep: ${methodId === performUpkeepSelector ? 'YES' : 'NO'}`);
    
    if (methodId === performUpkeepSelector) {
      console.log("├── ⚠️  This IS a performUpkeep call!");
      
      // 解析 performData
      try {
        const abiCoder = new ethers.AbiCoder();
        const decodedParams = abiCoder.decode(["bytes"], "0x" + tx.data.substring(10));
        const performData = decodedParams[0];
        console.log(`└── PerformData: ${performData}`);
        
        // 如果 performData 不为空，尝试进一步解析
        if (performData !== "0x") {
          try {
            const decoded = abiCoder.decode(['uint256', 'uint256[]', 'uint256'], performData);
            console.log(`    ├── Batch ID: ${decoded[0].toString()}`);
            console.log(`    ├── Intent IDs: [${decoded[1].map(id => id.toString()).join(', ')}]`);
            console.log(`    └── Min Batch Size: ${decoded[2].toString()}`);
          } catch (e) {
            console.log(`    └── Could not decode performData as expected format`);
          }
        }
      } catch (e) {
        console.log(`└── Failed to decode transaction data: ${e.message}`);
      }
    } else {
      console.log("├── This is NOT a performUpkeep call");
      console.log("└── Method might be from a different interface");
    }
    console.log("");

    // 3. 如果这确实是针对你的合约，检查当时的状态
    if (tx.to?.toLowerCase() === batchProcessorAddress.toLowerCase()) {
      console.log("🚨 CRITICAL: This transaction WAS for your BatchProcessor!");
      console.log("This confirms the Chainlink automation issue.");
      
      // 分析交易失败原因
      if (receipt.status === 0) {
        console.log("├── Transaction FAILED - this is actually good!");
        console.log("├── It means performUpkeep was called but reverted");
        console.log("└── Your contract correctly rejected the invalid call");
      } else {
        console.log("├── Transaction SUCCEEDED - this is problematic!");
        console.log("├── performUpkeep was called despite checkUpkeep returning false");
        console.log("└── This indicates a Chainlink timing or configuration issue");
      }
    } else {
      console.log("✅ This transaction was NOT for your BatchProcessor");
      console.log("├── Target contract is different");
      console.log("└── Your automation is working correctly");
    }
    console.log("");

    // 4. 当前系统状态检查
    console.log("🔧 Current System State Check:");
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
    
    // 生成相同的 checkData
    const abiCoder = new ethers.AbiCoder();
    const checkData = abiCoder.encode(['uint256', 'uint256'], [5, 7200]);
    
    console.log(`├── Using checkData: ${checkData}`);
    
    // 调用 checkUpkeep
    const result = await batchProcessor.checkUpkeep(checkData);
    console.log(`├── Current checkUpkeep result: ${result.upkeepNeeded}`);
    console.log(`├── Current performData: ${result.performData}`);
    
    // 检查系统状态
    const automationEnabled = await batchProcessor.automationEnabled();
    const paused = await batchProcessor.paused();
    const lastProcessedBatch = await batchProcessor.lastProcessedBatch();
    
    console.log(`├── Automation Enabled: ${automationEnabled}`);
    console.log(`├── Paused: ${paused}`);
    console.log(`└── Last Processed Batch: ${lastProcessedBatch.toString()}`);
    console.log("");

    // 5. 时间线分析
    console.log("⏰ Timeline Analysis:");
    console.log("====================");
    
    const txTime = block.timestamp;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - txTime;
    
    console.log(`├── Transaction Time: ${new Date(txTime * 1000).toLocaleString()}`);
    console.log(`├── Current Time: ${new Date(currentTime * 1000).toLocaleString()}`);
    console.log(`├── Time Difference: ${timeDiff} seconds (${Math.floor(timeDiff/60)} minutes)`);
    console.log("");

    // 6. 可能的解释
    console.log("💡 Possible Explanations:");
    console.log("=========================");
    
    if (tx.to?.toLowerCase() === batchProcessorAddress.toLowerCase()) {
      console.log("For BatchProcessor transaction:");
      console.log("├── 1. Race condition: State changed between checkUpkeep and performUpkeep");
      console.log("├── 2. Chainlink node cached old checkUpkeep result");
      console.log("├── 3. Different checkData used than expected");
      console.log("├── 4. Chainlink automation configuration issue");
      console.log("├── 5. Network congestion delayed state updates");
      console.log("└── 6. Multiple Chainlink nodes with inconsistent views");
    } else {
      console.log("For non-BatchProcessor transaction:");
      console.log("├── 1. Different automation registration triggered");
      console.log("├── 2. Another contract with different logic");
      console.log("├── 3. Manual performUpkeep call");
      console.log("└── 4. Unrelated Chainlink automation");
    }
    console.log("");

    // 7. 建议的调查步骤
    console.log("🔍 Recommended Investigation:");
    console.log("=============================");
    console.log("├── 1. Check Chainlink Automation registry for your upkeep ID");
    console.log("├── 2. Verify the checkData configuration in Chainlink dashboard");
    console.log("├── 3. Look for multiple automation registrations");
    console.log("├── 4. Monitor checkUpkeep calls before next performUpkeep");
    console.log("├── 5. Add logging to checkUpkeep function");
    console.log("└── 6. Contact Chainlink support if issue persists");

  } catch (error) {
    console.error("❌ Analysis Error:", error.message);
  }
}

deepAnalyzeChainlinkIssue().catch(console.error);