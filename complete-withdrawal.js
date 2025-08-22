const hre = require("hardhat");

async function main() {
  console.log("🔧 Completing withdrawal process for stuck user...");
  
  // Contract addresses
  const FUND_POOL_ADDRESS = "0xc0580b49B0e095cCB47FB6A9a79222106Aa93397";
  
  // Get signer - this should be the stuck user
  const [signer] = await hre.ethers.getSigners();
  console.log("🔑 Signer address:", signer.address);
  console.log("⚠️  Make sure this is the stuck user's address!");
  
  // Get contract instance
  const fundPool = await hre.ethers.getContractAt("FundPool", FUND_POOL_ADDRESS);
  
  try {
    console.log("📊 Pre-withdrawal status...");
    const isInitialized = await fundPool.isBalanceInitialized(signer.address);
    console.log("💰 Balance initialized:", isInitialized);
    
    if (!isInitialized) {
      console.log("❌ User balance not initialized, cannot withdraw");
      return;
    }
    
    console.log("🔄 Initiating withdrawal to complete the process...");
    
    // Call initiateWithdrawal to trigger the decryption process
    const tx = await fundPool.initiateWithdrawal();
    console.log("📤 Transaction sent:", tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    
    console.log("⏳ Withdrawal request submitted!");
    console.log("📋 Next steps:");
    console.log("   1. Wait for FHEVM to decrypt the balance (may take several minutes)");
    console.log("   2. The onWithdrawalDecrypted function will automatically:");
    console.log("      - Update user state to WITHDRAWN");
    console.log("      - Transfer any USDC balance to user");
    console.log("      - Reset encrypted balance to 0");
    console.log("   3. User can then deposit again to become ACTIVE");
    
    // Get the withdrawal request ID from events
    const withdrawalEvent = receipt.logs.find(log => {
      try {
        const parsed = fundPool.interface.parseLog(log);
        return parsed.name === "WithdrawalInitiated";
      } catch (e) {
        return false;
      }
    });
    
    if (withdrawalEvent) {
      const parsed = fundPool.interface.parseLog(withdrawalEvent);
      console.log("🆔 Withdrawal request ID:", parsed.args.requestId.toString());
    }
    
  } catch (error) {
    if (error.message.includes("WithdrawalPending")) {
      console.log("⚠️  Withdrawal already pending, wait for it to complete");
    } else if (error.message.includes("BalanceNotInitialized")) {
      console.log("❌ Balance not initialized");
    } else {
      console.error("❌ Error initiating withdrawal:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script error:", error);
    process.exit(1);
  });