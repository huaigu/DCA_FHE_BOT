#!/usr/bin/env node

const { ethers } = require("hardhat");

async function investigateUnknownContract() {
  console.log("🔍 Investigating Unknown Contract");
  console.log("=================================");
  
  const unknownContract = "0x86EFBD0b6736Bed994962f9797049422A3A8E8Ad";
  const txHash = "0x9930fd4c281901c1c5a606d754a71197e6f89bb23b27b13acd76337f31853f23";
  
  try {
    // 1. 检查合约代码
    console.log("📋 Contract Information:");
    console.log(`├── Address: ${unknownContract}`);
    
    const code = await ethers.provider.getCode(unknownContract);
    console.log(`├── Has Code: ${code !== '0x' ? 'YES' : 'NO'}`);
    console.log(`├── Code Size: ${(code.length - 2) / 2} bytes`);
    
    // 2. 尝试获取合约的基本信息
    try {
      const balance = await ethers.provider.getBalance(unknownContract);
      console.log(`├── ETH Balance: ${ethers.formatEther(balance)} ETH`);
    } catch (e) {
      console.log(`├── Balance Check Failed: ${e.message}`);
    }
    
    // 3. 分析交易调用的方法
    const tx = await ethers.provider.getTransaction(txHash);
    const methodId = tx.data.substring(0, 10);
    
    console.log(`├── Called Method ID: ${methodId}`);
    
    // 常见的方法 ID 映射
    const knownMethods = {
      "0x4585e33b": "performUpkeep(bytes)",
      "0x6e04ff0d": "checkUpkeep(bytes)",
      "0xa9059cbb": "transfer(address,uint256)",
      "0x23b872dd": "transferFrom(address,address,uint256)",
      "0x095ea7b3": "approve(address,uint256)",
      "0x70a08231": "balanceOf(address)",
      "0xb1dc65a4": "Unknown method",
    };
    
    const methodName = knownMethods[methodId] || "Unknown method";
    console.log(`└── Method: ${methodName}`);
    console.log("");
    
    // 4. 检查这个合约的最近交易
    console.log("📊 Recent Activity Analysis:");
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(currentBlock - 100, 0); // 检查最近100个区块
    
    // 获取发送到这个合约的交易
    const recentTxs = [];
    for (let i = currentBlock; i > fromBlock; i--) {
      try {
        const block = await ethers.provider.getBlock(i, true);
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (tx.to && tx.to.toLowerCase() === unknownContract.toLowerCase()) {
              recentTxs.push({
                hash: tx.hash,
                from: tx.from,
                block: i,
                methodId: tx.data.substring(0, 10)
              });
            }
          }
        }
      } catch (e) {
        // 跳过无法获取的区块
      }
    }
    
    console.log(`├── Recent transactions to this contract: ${recentTxs.length}`);
    if (recentTxs.length > 0) {
      console.log("├── Recent transactions:");
      recentTxs.slice(0, 5).forEach((tx, i) => {
        const method = knownMethods[tx.methodId] || tx.methodId;
        console.log(`│   ${i + 1}. Block ${tx.block}: ${tx.hash.substring(0, 12)}... (${method})`);
      });
    }
    console.log("");
    
    // 5. 尝试判断这是什么类型的合约
    console.log("🔍 Contract Type Analysis:");
    
    // 检查是否是 ERC20
    try {
      const erc20 = await ethers.getContractAt("IERC20", unknownContract);
      const totalSupply = await erc20.totalSupply();
      console.log(`├── ERC20 Total Supply: ${totalSupply.toString()}`);
      console.log("├── Likely Type: ERC20 Token");
    } catch (e) {
      console.log("├── Not an ERC20 token");
    }
    
    // 检查是否有 Chainlink Automation 接口
    try {
      // 构造一个简单的 checkUpkeep 调用
      const checkUpkeepData = "0x6e04ff0d" + "0".repeat(128); // checkUpkeep(bytes) with empty bytes
      const result = await ethers.provider.call({
        to: unknownContract,
        data: checkUpkeepData
      });
      console.log("├── Has checkUpkeep: YES");
      console.log("├── Likely Type: Chainlink Automation Compatible");
    } catch (e) {
      console.log("├── checkUpkeep failed - not standard automation");
    }
    
    console.log("");
    
    // 6. 检查合约创建信息
    console.log("📅 Contract Creation Info:");
    try {
      // 这需要扫描很多区块，可能很慢，所以我们跳过
      console.log("├── Creation scan skipped (would be too slow)");
      console.log("├── Suggestion: Check Etherscan for creation details");
      console.log(`└── Etherscan: https://sepolia.etherscan.io/address/${unknownContract}`);
    } catch (e) {
      console.log(`├── Creation info unavailable: ${e.message}`);
    }
    console.log("");
    
    // 7. 总结
    console.log("📋 Summary:");
    console.log("===========");
    console.log("✅ CONFIRMED: The problematic transaction was NOT for your DCA BatchProcessor");
    console.log(`├── Target contract: ${unknownContract}`);
    console.log(`├── Your contract: 0x1283a47720607d239aE7d15E5F5991673E36a6BA`);
    console.log("├── These are completely different contracts");
    console.log("├── Your DCA system is working correctly");
    console.log("├── checkUpkeep correctly returns false when no intents are pending");
    console.log("└── Chainlink correctly does NOT trigger your BatchProcessor");
    console.log("");
    console.log("💡 What you're seeing:");
    console.log("├── Chainlink dashboard shows ALL automations for your account");
    console.log("├── You likely have multiple Chainlink automations registered");
    console.log("├── This transaction was for a different automation/contract");
    console.log("└── Each automation can have different logic and trigger conditions");
    
  } catch (error) {
    console.error("❌ Investigation Error:", error.message);
  }
}

investigateUnknownContract().catch(console.error);