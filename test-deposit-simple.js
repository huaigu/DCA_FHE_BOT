const { ethers } = require("ethers");

// Basic ERC20 ABI for USDC interactions
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

// Basic FundPool ABI for deposit
const FUND_POOL_ABI = [
  "function deposit(uint256 amount) external",
  "function isBalanceInitialized(address user) view returns (bool)",
  "function totalDeposited() view returns (uint256)",
  "function usdcToken() view returns (address)"
];

async function main() {
  console.log("🔍 Testing Deposit Flow on Sepolia");
  
  // Test private key provided by user
  const testPrivateKey = "0x3d3a48a341c2a98ddbb705573484ddae05c4296dc1a009cee457345e0c4cec7d";
  
  // Use environment variable or hardcoded for testing
  const INFURA_API_KEY = process.env.INFURA_API_KEY || "126e2978c6db47b7b116c07e4ba787e9";
  
  // Create wallet from private key
  const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${INFURA_API_KEY}`);
  const wallet = new ethers.Wallet(testPrivateKey, provider);
  const testAddress = wallet.address;
  
  console.log("📋 Test wallet address:", testAddress);
  
  // Contract addresses from deployment
  const FUND_POOL_ADDRESS = "0xfd782b3Ca5Ef7Ac8B403afA3227DC528228E42B8";
  const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Working USDC address on Sepolia
  
  try {
    // Step 1: Check ETH balance
    console.log("\n💰 Checking ETH balance...");
    const ethBalance = await provider.getBalance(testAddress);
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    console.log(`ETH Balance: ${ethBalanceFormatted} ETH`);
    
    if (ethBalance < ethers.parseEther("0.001")) {
      console.log("⚠️ Low ETH balance. May not be sufficient for gas fees");
    }
    
    // Step 2: Check if USDC contract exists
    console.log("\n🔍 Checking USDC contract...");
    const usdcCode = await provider.getCode(USDC_ADDRESS);
    if (usdcCode === "0x") {
      console.log("❌ USDC contract not found at", USDC_ADDRESS);
      console.log("This appears to be a configuration issue. The USDC address may be incorrect for Sepolia.");
      
      // Let's check what's at this address
      const balance = await provider.getBalance(USDC_ADDRESS);
      console.log(`Balance at USDC address: ${ethers.formatEther(balance)} ETH`);
      return;
    }
    console.log("✅ USDC contract found");
    
    // Step 3: Check FundPool contract
    console.log("\n🔍 Checking FundPool contract...");
    const fundPoolCode = await provider.getCode(FUND_POOL_ADDRESS);
    if (fundPoolCode === "0x") {
      console.log("❌ FundPool contract not found at", FUND_POOL_ADDRESS);
      return;
    }
    console.log("✅ FundPool contract found");
    
    // Create contract instances
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    const fundPool = new ethers.Contract(FUND_POOL_ADDRESS, FUND_POOL_ABI, wallet);
    
    // Step 4: Check USDC contract details
    console.log("\n📝 USDC Contract Info:");
    try {
      const name = await usdc.name();
      const symbol = await usdc.symbol();
      const decimals = await usdc.decimals();
      console.log(`Name: ${name}`);
      console.log(`Symbol: ${symbol}`);
      console.log(`Decimals: ${decimals}`);
    } catch (error) {
      console.log("❌ Failed to get USDC contract info:", error.message);
      return;
    }
    
    // Step 5: Check USDC balance
    console.log("\n💵 Checking USDC balance...");
    const usdcBalance = await usdc.balanceOf(testAddress);
    const usdcBalanceFormatted = ethers.formatUnits(usdcBalance, 6);
    console.log(`USDC Balance: ${usdcBalanceFormatted} USDC`);
    
    if (usdcBalance < ethers.parseUnits("10", 6)) {
      console.log("❌ Insufficient USDC balance. Need at least 10 USDC for testing");
      console.log("The test wallet needs to have USDC tokens to test deposit functionality");
      return;
    }
    
    // Step 6: Check current allowance
    console.log("\n🔐 Checking USDC allowance...");
    const currentAllowance = await usdc.allowance(testAddress, FUND_POOL_ADDRESS);
    const currentAllowanceFormatted = ethers.formatUnits(currentAllowance, 6);
    console.log(`Current allowance: ${currentAllowanceFormatted} USDC`);
    
    const depositAmount = ethers.parseUnits("10", 6); // 10 USDC
    
    // Step 7: Approve if needed
    if (currentAllowance < depositAmount) {
      console.log("\n📝 Approving USDC spending...");
      try {
        const approveTx = await usdc.approve(FUND_POOL_ADDRESS, depositAmount);
        console.log("Approval transaction:", approveTx.hash);
        console.log("Waiting for confirmation...");
        await approveTx.wait();
        console.log("✅ USDC approval confirmed");
        
        // Verify allowance
        const newAllowance = await usdc.allowance(testAddress, FUND_POOL_ADDRESS);
        console.log(`New allowance: ${ethers.formatUnits(newAllowance, 6)} USDC`);
      } catch (error) {
        console.log("❌ Approval failed:", error.message);
        return;
      }
    } else {
      console.log("✅ Sufficient allowance already exists");
    }
    
    // Step 8: Check if balance is initialized
    console.log("\n🔍 Checking balance initialization...");
    const isInitialized = await fundPool.isBalanceInitialized(testAddress);
    console.log(`Balance initialized: ${isInitialized}`);
    
    // Step 9: Test deposit
    console.log("\n💰 Testing deposit...");
    console.log(`Attempting to deposit: ${ethers.formatUnits(depositAmount, 6)} USDC`);
    
    try {
      // Estimate gas first
      console.log("Estimating gas...");
      const gasEstimate = await fundPool.deposit.estimateGas(depositAmount);
      console.log(`Estimated gas: ${gasEstimate.toString()}`);
      
      // Execute deposit
      const depositTx = await fundPool.deposit(depositAmount, {
        gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
      });
      console.log("Deposit transaction:", depositTx.hash);
      console.log("Waiting for confirmation...");
      
      const receipt = await depositTx.wait();
      console.log("✅ Deposit successful!");
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);
      
      // Check balances after deposit
      console.log("\n📊 Post-deposit balances:");
      const newUsdcBalance = await usdc.balanceOf(testAddress);
      console.log(`User USDC Balance: ${ethers.formatUnits(newUsdcBalance, 6)} USDC`);
      
      const poolUsdcBalance = await usdc.balanceOf(FUND_POOL_ADDRESS);
      console.log(`Pool USDC Balance: ${ethers.formatUnits(poolUsdcBalance, 6)} USDC`);
      
      const totalDeposited = await fundPool.totalDeposited();
      console.log(`Total Deposited: ${ethers.formatUnits(totalDeposited, 6)} USDC`);
      
    } catch (error) {
      console.error("❌ Deposit failed:", error);
      
      // Try to decode the error
      if (error.data) {
        console.log("Error data:", error.data);
      }
      if (error.reason) {
        console.log("Error reason:", error.reason);
      }
      if (error.code) {
        console.log("Error code:", error.code);
      }
    }
    
  } catch (error) {
    console.error("❌ Error during testing:", error);
  }
}

// Run the test
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});