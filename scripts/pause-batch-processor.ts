import { ethers } from "hardhat";

async function pauseBatchProcessor() {
  console.log("⏸️  Pausing BatchProcessor on Sepolia...");
  
  // BatchProcessor contract address on Sepolia
  const batchProcessorAddress = "0x1283a47720607d239aE7d15E5F5991673E36a6BA";
  
  // Get the contract instance
  const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
  
  // Get the signer (owner)
  const [signer] = await ethers.getSigners();
  console.log("📋 Signer address:", signer.address);
  
  // Check current pause status
  try {
    const isPaused = await batchProcessor.paused();
    console.log("🔍 Current pause status:", isPaused);
    
    if (isPaused) {
      console.log("⚠️  BatchProcessor is already paused");
      return;
    }
  } catch (error) {
    console.log("ℹ️  Could not check pause status, proceeding with pause...");
  }
  
  try {
    // Execute pause transaction
    console.log("📝 Executing pause transaction...");
    const tx = await batchProcessor.pause();
    
    console.log("⏳ Transaction submitted:", tx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log("✅ BatchProcessor paused successfully!");
      console.log("🔗 Transaction hash:", receipt.hash);
      console.log("⛽ Gas used:", receipt.gasUsed.toString());
      
      // Verify pause status
      const newPauseStatus = await batchProcessor.paused();
      console.log("🔍 New pause status:", newPauseStatus);
      
    } else {
      console.log("❌ Transaction failed");
    }
  } catch (error: any) {
    console.error("❌ Error pausing BatchProcessor:", error.message);
    
    if (error.message.includes("Ownable: caller is not the owner")) {
      console.log("💡 Make sure you're using the contract owner account");
    }
    
    throw error;
  }
}

pauseBatchProcessor().catch(console.error);