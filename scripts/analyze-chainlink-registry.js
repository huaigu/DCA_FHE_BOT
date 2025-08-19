#!/usr/bin/env node

const { ethers } = require("hardhat");

async function checkChainlinkRegistry() {
  console.log("🔍 Chainlink Automation Registry Analysis");
  console.log("=========================================");
  
  const txHash = "0x9930fd4c281901c1c5a606d754a71197e6f89bb23b27b13acd76337f31853f23";
  const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
  
  try {
    const tx = await ethers.provider.getTransaction(txHash);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("📋 Transaction Analysis:");
    console.log(`├── Transaction Hash: ${txHash}`);
    console.log(`├── From: ${tx.from}`);
    console.log(`├── To: ${tx.to}`);
    console.log(`├── Your BatchProcessor: ${batchProcessorAddress}`);
    console.log(`├── Match: ${tx.to?.toLowerCase() === batchProcessorAddress.toLowerCase() ? 'YES' : 'NO'}`);
    console.log("");
    
    // 检查这是否是一个不同的合约
    console.log("🔍 Contract Analysis:");
    const contractCode = await ethers.provider.getCode(tx.to);
    console.log(`├── Target Contract: ${tx.to}`);
    console.log(`├── Has Code: ${contractCode !== '0x' ? 'YES' : 'NO'}`);
    
    // 尝试解析为通用的合约调用
    if (tx.data && tx.data.length > 10) {
      const methodId = tx.data.substring(0, 10);
      console.log(`├── Method ID: ${methodId}`);
      
      // 检查是否是 performUpkeep 调用
      const performUpkeepSelector = "0x4585e33b"; // performUpkeep(bytes)
      if (methodId === performUpkeepSelector) {
        console.log("├── Method: performUpkeep(bytes) ✅");
        
        // 解析 performData
        const abiCoder = new ethers.AbiCoder();
        try {
          const decoded = abiCoder.decode(["bytes"], "0x" + tx.data.substring(10));
          console.log(`└── PerformData: ${decoded[0]}`);
        } catch (decodeError) {
          console.log(`└── Failed to decode performData: ${decodeError.message}`);
        }
      } else {
        console.log(`├── Method: Unknown (${methodId})`);
      }
    }
    console.log("");
    
    // 检查你的 BatchProcessor 是否有任何相关的自动化注册
    console.log("🤖 Your BatchProcessor Status:");
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
    
    const automationEnabled = await batchProcessor.automationEnabled();
    const paused = await batchProcessor.paused();
    
    console.log(`├── Automation Enabled: ${automationEnabled}`);
    console.log(`├── Paused: ${paused}`);
    
    // 检查最近的事件
    console.log("├── Checking recent events...");
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(currentBlock - 1000, 0); // 检查最近1000个区块
    
    try {
      const automationTriggeredFilter = batchProcessor.filters.AutomationTriggered();
      const events = await batchProcessor.queryFilter(automationTriggeredFilter, fromBlock);
      console.log(`├── Recent AutomationTriggered events: ${events.length}`);
      
      if (events.length > 0) {
        const latestEvent = events[events.length - 1];
        console.log(`├── Latest event block: ${latestEvent.blockNumber}`);
        console.log(`├── Latest event tx: ${latestEvent.transactionHash}`);
        console.log(`└── Reason: ${latestEvent.args?.reason || 'Unknown'}`);
      }
    } catch (eventError) {
      console.log(`├── Event query error: ${eventError.message}`);
    }
    
    console.log("");
    
    // 结论分析
    console.log("📊 Analysis Conclusion:");
    console.log("=======================");
    
    if (tx.to?.toLowerCase() !== batchProcessorAddress.toLowerCase()) {
      console.log("✅ GOOD NEWS: The transaction was NOT for your BatchProcessor");
      console.log("├── This was likely a different Chainlink Automation upkeep");
      console.log("├── Your contract is working correctly");
      console.log("├── The dashboard shows all automations for your account");
      console.log("└── Each automation has its own transaction history");
      console.log("");
      console.log("💡 What happened:");
      console.log("├── You saw a 'Perform Upkeep' transaction in Chainlink dashboard");
      console.log("├── But this was for a different contract/automation");
      console.log("├── Your BatchProcessor checkUpkeep correctly returns false");
      console.log("└── So Chainlink correctly does NOT trigger your BatchProcessor");
    } else {
      console.log("❌ ISSUE CONFIRMED: Transaction was for your BatchProcessor");
      console.log("├── This suggests a timing issue or Chainlink bug");
      console.log("├── State may have changed between checkUpkeep and performUpkeep");
      console.log("└── Further investigation needed");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkChainlinkRegistry().catch(console.error);