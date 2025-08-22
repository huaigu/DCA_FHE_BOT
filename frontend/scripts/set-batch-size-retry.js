const { ethers } = require("ethers");

async function setMinBatchSizeRetry() {
    console.log("🔧 Retrying to set MinBatchSize to 2...");
    
    const intentCollectorAddress = "0x768Dd3993b5Ce23B64De65Db678f843564cbeCd5";
    const rpcUrl = "https://sepolia.infura.io/v3/126e2978c6db47b7b116c07e4ba787e9";
    
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ Please set PRIVATE_KEY environment variable");
        return;
    }
    
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        const abi = [
            "function minBatchSize() public view returns (uint256)",
            "function setMinBatchSize(uint256 _minBatchSize) external",
            "function owner() public view returns (address)"
        ];
        
        const intentCollector = new ethers.Contract(intentCollectorAddress, abi, wallet);
        
        // Check current state
        const currentMinBatchSize = await intentCollector.minBatchSize();
        console.log("📊 Current MinBatchSize:", currentMinBatchSize.toString());
        
        if (currentMinBatchSize.toString() === "2") {
            console.log("✅ MinBatchSize is already set to 2!");
            return;
        }
        
        // Estimate gas first
        const gasEstimate = await intentCollector.setMinBatchSize.estimateGas(2);
        console.log("⛽ Estimated gas:", gasEstimate.toString());
        
        // Set new minBatchSize with explicit gas settings
        console.log("🔄 Setting MinBatchSize to 2...");
        const tx = await intentCollector.setMinBatchSize(2, {
            gasLimit: gasEstimate * 2n, // Use 2x estimated gas for safety
            gasPrice: ethers.parseUnits("20", "gwei") // Explicit gas price
        });
        
        console.log("📝 Transaction hash:", tx.hash);
        console.log("🔍 View on Etherscan: https://sepolia.etherscan.io/tx/" + tx.hash);
        
        // Wait for confirmation with longer timeout
        console.log("⏳ Waiting for confirmation (max 5 minutes)...");
        const receipt = await tx.wait(1, 300000); // 5 minute timeout
        
        if (receipt.status === 1) {
            console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
            
            // Verify the change
            const updatedMinBatchSize = await intentCollector.minBatchSize();
            console.log("🎉 Updated MinBatchSize:", updatedMinBatchSize.toString());
            
            if (updatedMinBatchSize.toString() === "2") {
                console.log("✅ MinBatchSize successfully updated to 2!");
            } else {
                console.log("❌ MinBatchSize update failed!");
            }
        } else {
            console.log("❌ Transaction failed!");
        }
        
    } catch (error) {
        console.error("❌ Error setting MinBatchSize:", error.message);
        if (error.code) {
            console.error("Error code:", error.code);
        }
        if (error.reason) {
            console.error("Error reason:", error.reason);
        }
    }
}

setMinBatchSizeRetry().catch(console.error);
