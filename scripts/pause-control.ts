import { ethers } from "hardhat";
import { BatchProcessor } from "../types";

interface PauseControlParams {
  contractAddress: string;
  shouldPause: boolean;
  network: string;
}

async function controlBatchProcessorPause(params: PauseControlParams) {
  const { contractAddress, shouldPause, network } = params;
  
  console.log("🎛️  BatchProcessor Pause Control");
  console.log("================================");
  console.log(`📋 Contract Address: ${contractAddress}`);
  console.log(`🌐 Network: ${network}`);
  console.log(`⚡ Action: ${shouldPause ? 'PAUSE' : 'UNPAUSE'}`);
  
  // Validate contract address
  if (!ethers.isAddress(contractAddress)) {
    throw new Error("❌ Invalid contract address");
  }
  
  // Get the contract instance
  const batchProcessor = await ethers.getContractAt("BatchProcessor", contractAddress) as BatchProcessor;
  
  // Get the signer (owner)
  const [signer] = await ethers.getSigners();
  console.log(`👤 Signer address: ${signer.address}`);
  
  try {
    // Check current pause status
    const currentPauseStatus = await batchProcessor.paused();
    console.log(`🔍 Current pause status: ${currentPauseStatus}`);
    
    // Check if action is necessary
    if (currentPauseStatus === shouldPause) {
      console.log(`⚠️  BatchProcessor is already ${shouldPause ? 'paused' : 'unpaused'}`);
      return;
    }
    
    // Execute the appropriate action
    const action = shouldPause ? 'pause' : 'unpause';
    console.log(`📝 Executing ${action} transaction...`);
    
    const tx = shouldPause ? 
      await batchProcessor.pause() : 
      await batchProcessor.unpause();
    
    console.log(`⏳ Transaction submitted: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    if (receipt?.status === 1) {
      console.log(`✅ BatchProcessor ${shouldPause ? 'paused' : 'unpaused'} successfully!`);
      console.log(`🔗 Transaction hash: ${receipt.hash}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
      
      // Verify new pause status
      const newPauseStatus = await batchProcessor.paused();
      console.log(`🔍 New pause status: ${newPauseStatus}`);
      
      // Additional status checks
      const automationEnabled = await batchProcessor.automationEnabled();
      console.log(`🤖 Automation enabled: ${automationEnabled}`);
      
    } else {
      console.log("❌ Transaction failed");
    }
  } catch (error: any) {
    console.error(`❌ Error ${shouldPause ? 'pausing' : 'unpausing'} BatchProcessor:`, error.message);
    
    if (error.message.includes("Ownable: caller is not the owner")) {
      console.log("💡 Make sure you're using the contract owner account");
    }
    
    throw error;
  }
}

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log("❌ Usage: npx hardhat run scripts/pause-control.ts --network sepolia -- <CONTRACT_ADDRESS> <true|false>");
    console.log("📋 Examples:");
    console.log("  npx hardhat run scripts/pause-control.ts --network sepolia -- 0x1283a47720607d239aE7d15E5F5991673E36a6BA true");
    console.log("  npx hardhat run scripts/pause-control.ts --network sepolia -- 0x1283a47720607d239aE7d15E5F5991673E36a6BA false");
    process.exit(1);
  }
  
  const contractAddress = args[0];
  const shouldPauseStr = args[1].toLowerCase();
  
  if (shouldPauseStr !== 'true' && shouldPauseStr !== 'false') {
    console.log("❌ Second parameter must be 'true' or 'false'");
    process.exit(1);
  }
  
  const shouldPause = shouldPauseStr === 'true';
  const network = process.env.HARDHAT_NETWORK || 'localhost';
  
  await controlBatchProcessorPause({
    contractAddress,
    shouldPause,
    network
  });
}

// Predefined addresses for quick access
const SEPOLIA_ADDRESSES = {
  BATCH_PROCESSOR: "0x1283a47720607d239aE7d15E5F5991673E36a6BA"
};

// Helper functions for quick actions
export async function pauseBatchProcessor(contractAddress?: string) {
  const address = contractAddress || SEPOLIA_ADDRESSES.BATCH_PROCESSOR;
  await controlBatchProcessorPause({
    contractAddress: address,
    shouldPause: true,
    network: "sepolia"
  });
}

export async function unpauseBatchProcessor(contractAddress?: string) {
  const address = contractAddress || SEPOLIA_ADDRESSES.BATCH_PROCESSOR;
  await controlBatchProcessorPause({
    contractAddress: address,
    shouldPause: false,
    network: "sepolia"
  });
}

// Quick pause for deployed Sepolia contract
export async function quickPause() {
  console.log("🚨 Quick Pause - Using deployed Sepolia contract");
  await pauseBatchProcessor();
}

// Quick unpause for deployed Sepolia contract
export async function quickUnpause() {
  console.log("▶️  Quick Unpause - Using deployed Sepolia contract");
  await unpauseBatchProcessor();
}

// Run main function if script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { controlBatchProcessorPause };