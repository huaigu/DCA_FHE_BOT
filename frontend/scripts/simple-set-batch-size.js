require('dotenv').config();
const { ethers } = require("ethers");

async function setMinBatchSize() {
    console.log("🔧 Setting MinBatchSize to 2...");
    
    // Load addresses from .env
    const intentCollectorAddress = process.env.NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS;
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!intentCollectorAddress || !rpcUrl || !privateKey) {
        console.error("❌ Missing required environment variables:");
        console.error("- NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS:", !!intentCollectorAddress);
        console.error("- NEXT_PUBLIC_SEPOLIA_RPC_URL:", !!rpcUrl);
        console.error("- PRIVATE_KEY:", !!privateKey);
        return;
    }
    
    const newMinBatchSize = 2;
    
    try {
        // Setup provider and wallet
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        console.log("👤 Using wallet address:", wallet.address);
        console.log("📍 IntentCollector address:", intentCollectorAddress);
        
        // Contract ABI (only the functions we need)
        const abi = [
            "function minBatchSize() public view returns (uint256)",
            "function setMinBatchSize(uint256 _minBatchSize) external",
            "function owner() public view returns (address)"
        ];
        
        // Connect to contract
        const intentCollector = new ethers.Contract(intentCollectorAddress, abi, wallet);
        
        // Check current minBatchSize
        const currentMinBatchSize = await intentCollector.minBatchSize();
        console.log("📊 Current MinBatchSize:", currentMinBatchSize.toString());
        
        if (currentMinBatchSize.toString() === newMinBatchSize.toString()) {
            console.log("✅ MinBatchSize is already set to", newMinBatchSize);
            return;
        }
        
        // Check if wallet is owner
        const owner = await intentCollector.owner();
        console.log("🔑 Contract owner:", owner);
        console.log("📝 Wallet address:", wallet.address);
        
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error("❌ Wallet is not the contract owner!");
            return;
        }
        
        // Set new minBatchSize
        console.log("🔄 Setting MinBatchSize to:", newMinBatchSize);
        const tx = await intentCollector.setMinBatchSize(newMinBatchSize);
        console.log("📝 Transaction hash:", tx.hash);
        console.log("🔍 View on Etherscan:", `${process.env.NEXT_PUBLIC_EXPLORER_URL}/tx/${tx.hash}`);
        
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
        if (error.code) {
            console.error("Error code:", error.code);
        }
    }
}

setMinBatchSize().catch(console.error);