const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking specific user status...");
  
  // Contract addresses
  const INTENT_COLLECTOR_ADDRESS = "0x2f1DD937bAb10246139E626855071227e70738C4";
  const FUND_POOL_ADDRESS = "0xc0580b49B0e095cCB47FB6A9a79222106Aa93397";
  const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  // Specific user address
  const userAddress = "0x170a6bbee5a0baa90012d9c5ca541f27afb43b9a";
  console.log("👤 User address:", userAddress);
  
  // Get contract instances
  const intentCollector = await hre.ethers.getContractAt("IntentCollector", INTENT_COLLECTOR_ADDRESS);
  const fundPool = await hre.ethers.getContractAt("FundPool", FUND_POOL_ADDRESS);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);
  
  try {
    console.log("\n=== USDC Balance Check ===");
    // Check USDC balance
    const usdcBalance = await usdc.balanceOf(userAddress);
    const decimals = await usdc.decimals();
    console.log("💰 USDC wallet balance:", hre.ethers.formatUnits(usdcBalance, decimals), "USDC");
    
    // Check USDC allowance to FundPool
    const allowance = await usdc.allowance(userAddress, FUND_POOL_ADDRESS);
    console.log("🔐 USDC allowance to FundPool:", hre.ethers.formatUnits(allowance, decimals), "USDC");

    console.log("\n=== FundPool Status ===");
    // Check if user has balance in FundPool
    const isBalanceInitialized = await fundPool.isBalanceInitialized(userAddress);
    console.log("💰 Is balance initialized in FundPool:", isBalanceInitialized);
    
    console.log("\n=== IntentCollector Status ===");
    // Check user state in IntentCollector
    const userState = await intentCollector.userStates(userAddress);
    console.log("📊 User state in IntentCollector:", userState.toString());
    
    const stateNames = ["UNINITIALIZED", "ACTIVE", "WITHDRAWING", "WITHDRAWN"];
    console.log("📊 User state name:", stateNames[userState] || "UNKNOWN");
    
    console.log("\n=== Configuration Check ===");
    // Check if FundPool is set in IntentCollector
    const fundPoolAddress = await intentCollector.fundPool();
    console.log("🔗 FundPool address in IntentCollector:", fundPoolAddress);
    console.log("🔗 Expected FundPool address:", FUND_POOL_ADDRESS);
    console.log("🔗 FundPool correctly set:", fundPoolAddress.toLowerCase() === FUND_POOL_ADDRESS.toLowerCase());
    
    console.log("\n=== Diagnosis ===");
    if (!isBalanceInitialized) {
      console.log("❌ Problem: User balance not initialized in FundPool");
      
      if (usdcBalance > 0) {
        if (allowance > 0) {
          console.log("💡 Solution: User needs to call FundPool.deposit() function");
        } else {
          console.log("💡 Solution: User needs to approve USDC spending first, then deposit");
        }
      } else {
        console.log("💡 Solution: User needs to get USDC from faucet first");
      }
    } else {
      console.log("✅ FundPool balance is initialized");
      if (userState == 0) {
        console.log("❌ Problem: User state in IntentCollector is still UNINITIALIZED");
        console.log("💡 This should auto-update when submitting intent");
      }
    }
    
  } catch (error) {
    console.error("❌ Error checking user status:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script error:", error);
    process.exit(1);
  });