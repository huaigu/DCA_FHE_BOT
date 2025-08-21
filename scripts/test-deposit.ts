import { ethers } from "ethers";

// Basic ERC20 ABI for USDC interactions
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function mint(address to, uint256 amount) returns (bool)" // For mock contracts
];

// Basic FundPool ABI for deposit
const FUND_POOL_ABI = [
  "function deposit(uint256 amount) external",
  "function isBalanceInitialized(address user) view returns (bool)",
  "function totalDeposited() view returns (uint256)",
  "function usdcToken() view returns (address)"
];

// Mock ERC20 ABI for deployment
const MOCK_ERC20_ABI = [
  ...ERC20_ABI,
  "constructor(string name, string symbol, uint8 decimals)"
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
  const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  try {
    // Step 1: Check ETH balance
    console.log("\n💰 Checking ETH balance...");
    const ethBalance = await provider.getBalance(testAddress);
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    console.log(`ETH Balance: ${ethBalanceFormatted} ETH`);
    
    if (ethBalance < ethers.parseEther("0.01")) {
      console.log("❌ Insufficient ETH for gas fees. Need at least 0.01 ETH");
      return;
    }
    
    // Step 2: Check if USDC contract exists
    console.log("\n🔍 Checking USDC contract...");
    const usdcCode = await provider.getCode(USDC_ADDRESS);
    if (usdcCode === "0x") {
      console.log("❌ USDC contract not found at", USDC_ADDRESS);
      console.log("This might be a testnet address issue. Let's deploy a mock USDC for testing.");
      
      console.log("❌ USDC contract not deployed at this address on Sepolia");
      console.log("This appears to be a configuration issue. The USDC address in contracts.ts may be incorrect for Sepolia.");
      console.log("We need to either:");
      console.log("1. Use the correct Sepolia USDC address, or");
      console.log("2. Deploy and configure our own mock USDC for testing");
      return;
    } else {
      // Use real USDC contract  
      console.log("✅ USDC contract found");
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
      await testDepositFlow(wallet, FUND_POOL_ADDRESS, usdc);
    }
    
  } catch (error) {
    console.error("❌ Error during testing:", error);
  }
}

async function testDepositFlow(wallet: ethers.Wallet, fundPoolAddress: string, usdc: any) {
  const testAddress = wallet.address;
  
  try {
    // Step 3: Check USDC balance
    console.log("\n💵 Checking USDC balance...");
    const usdcBalance = await usdc.balanceOf(testAddress);
    const usdcBalanceFormatted = ethers.formatUnits(usdcBalance, 6);
    console.log(`USDC Balance: ${usdcBalanceFormatted} USDC`);
    
    if (usdcBalance < ethers.parseUnits("10", 6)) {
      console.log("❌ Insufficient USDC balance. Need at least 10 USDC for testing");
      return;
    }
    
    // Step 4: Check FundPool contract
    console.log("\n🔍 Checking FundPool contract...");
    const fundPoolCode = await wallet.provider.getCode(fundPoolAddress);
    if (fundPoolCode === "0x") {
      console.log("❌ FundPool contract not found at", fundPoolAddress);
      return;
    }
    console.log("✅ FundPool contract found");
    
    // Get FundPool contract
    const fundPool = new ethers.Contract(fundPoolAddress, FUND_POOL_ABI, wallet);
    
    // Step 5: Check current allowance
    console.log("\n🔐 Checking USDC allowance...");
    const currentAllowance = await usdc.allowance(testAddress, fundPoolAddress);
    const currentAllowanceFormatted = ethers.formatUnits(currentAllowance, 6);
    console.log(`Current allowance: ${currentAllowanceFormatted} USDC`);
    
    const depositAmount = ethers.parseUnits("10", 6); // 10 USDC
    
    // Step 6: Approve if needed
    if (currentAllowance < depositAmount) {
      console.log("\n📝 Approving USDC spending...");
      const approveTx = await usdc.approve(fundPoolAddress, depositAmount);
      console.log("Approval transaction:", approveTx.hash);
      await approveTx.wait();
      console.log("✅ USDC approval confirmed");
      
      // Verify allowance
      const newAllowance = await usdc.allowance(testAddress, fundPoolAddress);
      console.log(`New allowance: ${ethers.formatUnits(newAllowance, 6)} USDC`);
    } else {
      console.log("✅ Sufficient allowance already exists");
    }
    
    // Step 7: Test deposit
    console.log("\n💰 Testing deposit...");
    console.log(`Depositing: ${ethers.formatUnits(depositAmount, 6)} USDC`);
    
    // Check if balance is initialized
    const isInitialized = await fundPool.isBalanceInitialized(testAddress);
    console.log(`Balance initialized: ${isInitialized}`);
    
    try {
      // Estimate gas first
      const gasEstimate = await fundPool.deposit.estimateGas(depositAmount);
      console.log(`Estimated gas: ${gasEstimate.toString()}`);
      
      // Execute deposit
      const depositTx = await fundPool.deposit(depositAmount, {
        gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
      });
      console.log("Deposit transaction:", depositTx.hash);
      
      const receipt = await depositTx.wait();
      console.log("✅ Deposit successful!");
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);
      
      // Check balances after deposit
      console.log("\n📊 Post-deposit balances:");
      const newUsdcBalance = await usdc.balanceOf(testAddress);
      console.log(`USDC Balance: ${ethers.formatUnits(newUsdcBalance, 6)} USDC`);
      
      const poolUsdcBalance = await usdc.balanceOf(fundPoolAddress);
      console.log(`Pool USDC Balance: ${ethers.formatUnits(poolUsdcBalance, 6)} USDC`);
      
      const totalDeposited = await fundPool.totalDeposited();
      console.log(`Total Deposited: ${ethers.formatUnits(totalDeposited, 6)} USDC`);
      
    } catch (error: any) {
      console.error("❌ Deposit failed:", error.message);
      
      // Try to get more specific error info
      if (error.data) {
        console.log("Error data:", error.data);
      }
      if (error.reason) {
        console.log("Error reason:", error.reason);
      }
    }
    
  } catch (error) {
    console.error("❌ Error in deposit flow:", error);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});