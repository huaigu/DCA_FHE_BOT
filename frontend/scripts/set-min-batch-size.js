const hre = require("hardhat");
const { ethers } = require("hardhat");

async function setMinBatchSize() {
    console.log("🔧 Setting MinBatchSize to 2...");
    
    const intentCollectorAddress = "0x768Dd3993b5Ce23B64De65Db678f843564cbeCd5";
    const newMinBatchSize = 2;
    
    try {
        // Get signer (deployer)
        const [deployer] = await ethers.getSigners();
        console.log("👤 Using deployer address:", deployer.address);
        
        // Get IntentCollector contract
        const IntentCollector = await ethers.getContractFactory("IntentCollector");
        const intentCollector = IntentCollector.attach(intentCollectorAddress);
        
        // Check current minBatchSize
        const currentMinBatchSize = await intentCollector.minBatchSize();
        console.log("📊 Current MinBatchSize:", currentMinBatchSize.toString());
        
        if (currentMinBatchSize.toString() === newMinBatchSize.toString()) {
            console.log("✅ MinBatchSize is already set to", newMinBatchSize);
            return;
        }
        
        // Set new minBatchSize
        console.log("🔄 Setting MinBatchSize to:", newMinBatchSize);
        const tx = await intentCollector.setMinBatchSize(newMinBatchSize);
        console.log("📝 Transaction hash:", tx.hash);
        
        // Wait for confirmation
        console.log("⏳ Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
        
        // Verify the change
        const updatedMinBatchSize = await intentCollector.minBatchSize();
        console.log("🎉 New MinBatchSize:", updatedMinBatchSize.toString());
        
        if (updatedMinBatchSize.toString() === newMinBatchSize.toString()) {
            console.log("✅ MinBatchSize successfully updated!");
        } else {
            console.log("❌ MinBatchSize update failed!");
        }
        
    } catch (error) {
        console.error("❌ Error setting MinBatchSize:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

setMinBatchSize().catch(console.error);
