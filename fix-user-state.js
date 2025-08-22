const hre = require("hardhat");

async function main() {
  console.log("🔧 Attempting to fix user state...");
  
  // Contract addresses
  const INTENT_COLLECTOR_ADDRESS = "0x2f1DD937bAb10246139E626855071227e70738C4";
  const FUND_POOL_ADDRESS = "0xc0580b49B0e095cCB47FB6A9a79222106Aa93397";
  
  // Specific user address
  const userAddress = "0x170a6bbee5a0baa90012d9c5ca541f27afb43b9a";
  console.log("👤 User address:", userAddress);
  
  // Get signer (should be owner/admin)
  const [signer] = await hre.ethers.getSigners();
  console.log("🔑 Signer address:", signer.address);
  
  // Get contract instances
  const intentCollector = await hre.ethers.getContractAt("IntentCollector", INTENT_COLLECTOR_ADDRESS);
  const fundPool = await hre.ethers.getContractAt("FundPool", FUND_POOL_ADDRESS);
  
  try {
    // Check current state
    const currentState = await intentCollector.userStates(userAddress);
    console.log("📊 Current user state:", currentState.toString());
    
    // Check if we can call updateUserState from FundPool
    console.log("🔧 Attempting to reset user state to ACTIVE...");
    
    // Method 1: Try to call updateUserState through FundPool (if we're the owner)
    try {
      // The FundPool should be able to update user states
      // But we need to call it from FundPool, not directly
      
      // Let's check if there's a way to reset the user state
      // First, check if we're the owner of FundPool
      const fundPoolOwner = await fundPool.owner();
      console.log("👑 FundPool owner:", fundPoolOwner);
      console.log("🔑 Are we owner?", fundPoolOwner.toLowerCase() === signer.address.toLowerCase());
      
      if (fundPoolOwner.toLowerCase() === signer.address.toLowerCase()) {
        console.log("✅ We are the owner, let's try to fix this...");
        
        // Since updateUserState can only be called by FundPool or BatchProcessor,
        // and we don't see a direct admin function, we might need to:
        // 1. Check if there's a function in FundPool that can reset user state
        // 2. Or we might need to modify the contract
        
        console.log("⚠️  No direct admin function found to reset user state");
        console.log("📝 Possible solutions:");
        console.log("   1. Add admin function to reset user states");
        console.log("   2. User completes withdrawal process");
        console.log("   3. Reset through FundPool internal logic");
        
        // Let's check if the user can deposit again to potentially reset state
        console.log("💡 Alternative: User can try making another small deposit to reset state");
        
      } else {
        console.log("❌ We are not the owner, cannot perform admin actions");
      }
      
    } catch (err) {
      console.error("❌ Error during state reset:", err.message);
    }
    
  } catch (error) {
    console.error("❌ Error in fix process:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script error:", error);
    process.exit(1);
  });