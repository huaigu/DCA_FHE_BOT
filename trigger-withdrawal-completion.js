const hre = require("hardhat");

async function main() {
  console.log("🔧 Attempting to resolve user WITHDRAWING state...");
  
  // Contract addresses
  const FUND_POOL_ADDRESS = "0xc0580b49B0e095cCB47FB6A9a79222106Aa93397";
  
  // Specific user address
  const userAddress = "0x170a6bbee5a0baa90012d9c5ca541f27afb43b9a";
  console.log("👤 User address:", userAddress);
  
  // Get contract instances
  const fundPool = await hre.ethers.getContractAt("FundPool", FUND_POOL_ADDRESS);
  
  try {
    console.log("📊 Current status check...");
    
    // Check if there's any withdrawal request that needs to be processed
    const activeRequest = await fundPool.activeWithdrawalRequest(userAddress);
    console.log("🔄 Active withdrawal request ID:", activeRequest.toString());
    
    if (activeRequest == 0) {
      console.log("❌ No active withdrawal request found");
      console.log("💡 This is an inconsistent state - user is WITHDRAWING but no active request");
      console.log("🔧 Possible solutions:");
      console.log("   1. User manually initiates a new withdrawal to complete the process");
      console.log("   2. Admin intervention needed to reset user state");
      console.log("   3. User makes a small deposit to potentially reset state");
      
      // Let's try to see if user can initiate withdrawal to complete the process
      console.log("🔍 Checking if user can initiate withdrawal...");
      const [canWithdraw, reason] = await fundPool.canWithdraw(userAddress);
      console.log("🚪 Can withdraw:", canWithdraw);
      console.log("🚪 Reason:", reason);
      
      if (canWithdraw) {
        console.log("💡 Solution: User should call initiateWithdrawal() to complete the process");
      }
    } else {
      console.log("⏳ Active withdrawal request found, waiting for decryption...");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script error:", error);
    process.exit(1);
  });