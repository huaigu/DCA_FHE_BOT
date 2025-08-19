#!/usr/bin/env node

const { ethers } = require("hardhat");

// Sepolia 上部署的 BatchProcessor 合约地址
const SEPOLIA_BATCH_PROCESSOR = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";

async function pauseControl() {
  // 从环境变量获取参数，或使用默认值
  const contractAddress = process.env.CONTRACT_ADDRESS || SEPOLIA_BATCH_PROCESSOR;
  const shouldPause = process.env.SHOULD_PAUSE ? process.env.SHOULD_PAUSE.toLowerCase() === 'true' : true;
  
  console.log("🎛️  BatchProcessor Pause Control (Sepolia)");
  console.log("==========================================");
  console.log(`📋 Contract: ${contractAddress}`);
  console.log(`⚡ Action: ${shouldPause ? 'PAUSE ⏸️' : 'UNPAUSE ▶️'}`);
  
  try {
    // 连接合约
    const batchProcessor = await ethers.getContractAt("BatchProcessor", contractAddress);
    const [signer] = await ethers.getSigners();
    
    console.log(`👤 Signer: ${signer.address}`);
    
    // 检查当前状态
    const currentStatus = await batchProcessor.paused();
    console.log(`🔍 Current status: ${currentStatus ? 'PAUSED' : 'RUNNING'}`);
    
    if (currentStatus === shouldPause) {
      console.log(`✨ Already ${shouldPause ? 'paused' : 'running'} - no action needed`);
      return;
    }
    
    // 执行操作
    console.log(`📝 ${shouldPause ? 'Pausing' : 'Unpausing'} contract...`);
    const tx = shouldPause ? 
      await batchProcessor.pause() : 
      await batchProcessor.unpause();
    
    console.log(`⏳ TX: ${tx.hash}`);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      const newStatus = await batchProcessor.paused();
      console.log(`✅ Success! New status: ${newStatus ? 'PAUSED' : 'RUNNING'}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    } else {
      console.log("❌ Transaction failed");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.message.includes("caller is not the owner")) {
      console.log("💡 Make sure you're the contract owner");
    }
  }
}

// 使用说明
function showUsage() {
  console.log("📖 Usage Examples:");
  console.log("");
  console.log("# Pause (使用默认 Sepolia 地址):");
  console.log("SHOULD_PAUSE=true npx hardhat run scripts/pause-control-simple.js --network sepolia");
  console.log("");
  console.log("# Unpause (使用默认 Sepolia 地址):");
  console.log("SHOULD_PAUSE=false npx hardhat run scripts/pause-control-simple.js --network sepolia");
  console.log("");
  console.log("# 使用自定义合约地址:");
  console.log("CONTRACT_ADDRESS=0xYourAddress SHOULD_PAUSE=true npx hardhat run scripts/pause-control-simple.js --network sepolia");
  console.log("");
  console.log("📋 Default Contract: " + SEPOLIA_BATCH_PROCESSOR);
  console.log("📋 Default Action: PAUSE (true)");
}

// 检查环境变量是否显示帮助
if (process.env.HELP === 'true') {
  showUsage();
} else {
  pauseControl().catch(console.error);
}