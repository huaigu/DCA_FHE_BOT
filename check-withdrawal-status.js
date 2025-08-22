const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking withdrawal status...");
  
  // Contract addresses
  const FUND_POOL_ADDRESS = "0xc0580b49B0e095cCB47FB6A9a79222106Aa93397";
  
  // Specific user address
  const userAddress = "0x170a6bbee5a0baa90012d9c5ca541f27afb43b9a";
  console.log("👤 User address:", userAddress);
  
  // Get contract instances
  const fundPool = await hre.ethers.getContractAt("FundPool", FUND_POOL_ADDRESS);
  
  try {
    console.log("\n=== Withdrawal Status Check ===");
    
    // Check active withdrawal request
    const activeRequest = await fundPool.activeWithdrawalRequest(userAddress);
    console.log("🔄 Active withdrawal request ID:", activeRequest.toString());
    
    if (activeRequest > 0) {
      console.log("⏳ User has pending withdrawal request");
      
      // Get withdrawal request details
      try {
        const requestDetails = await fundPool.withdrawalRequests(activeRequest);
        console.log("📋 Request details:", {
          user: requestDetails.user,
          timestamp: new Date(Number(requestDetails.timestamp) * 1000).toISOString(),
          isProcessed: requestDetails.isProcessed
        });
      } catch (err) {
        console.log("❌ Could not get request details:", err.message);
      }
    } else {
      console.log("✅ No active withdrawal request");
    }
    
    // Check if user can withdraw
    try {
      const [canWithdraw, reason] = await fundPool.canWithdraw(userAddress);
      console.log("🚪 Can withdraw:", canWithdraw);
      console.log("🚪 Reason:", reason);
    } catch (err) {
      console.log("❌ Could not check withdrawal status:", err.message);
    }
    
    console.log("\n=== Solution ===");
    if (activeRequest > 0) {
      console.log("🔧 User needs to complete their withdrawal first:");
      console.log("   Option 1: Wait for withdrawal to complete automatically");
      console.log("   Option 2: Cancel withdrawal (if supported)");
      console.log("   Option 3: Complete withdrawal process");
    } else {
      console.log("❓ User state is WITHDRAWING but no active request found");
      console.log("🔧 This might need admin intervention to reset user state");
    }
    
  } catch (error) {
    console.error("❌ Error checking withdrawal status:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script error:", error);
    process.exit(1);
  });