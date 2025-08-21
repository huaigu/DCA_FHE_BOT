const { ethers } = require("ethers");

const FUND_POOL_ABI = [
  "function usdcToken() view returns (address)",
  "function owner() view returns (address)",
  "function batchProcessor() view returns (address)",
  "function intentCollector() view returns (address)",
  "function totalDeposited() view returns (uint256)",
  "function totalWithdrawn() view returns (uint256)"
];

async function main() {
  console.log("🔍 Checking FundPool Configuration");
  
  const INFURA_API_KEY = "126e2978c6db47b7b116c07e4ba787e9";
  const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${INFURA_API_KEY}`);
  
  const FUND_POOL_ADDRESS = "0xfd782b3Ca5Ef7Ac8B403afA3227DC528228E42B8";
  const EXPECTED_USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  try {
    const fundPool = new ethers.Contract(FUND_POOL_ADDRESS, FUND_POOL_ABI, provider);
    
    console.log("\n📋 FundPool Configuration:");
    
    const usdcToken = await fundPool.usdcToken();
    console.log(`USDC Token Address: ${usdcToken}`);
    console.log(`Expected USDC Address: ${EXPECTED_USDC_ADDRESS}`);
    console.log(`USDC Address Match: ${usdcToken.toLowerCase() === EXPECTED_USDC_ADDRESS.toLowerCase()}`);
    
    const owner = await fundPool.owner();
    console.log(`Owner: ${owner}`);
    
    const batchProcessor = await fundPool.batchProcessor();
    console.log(`Batch Processor: ${batchProcessor}`);
    
    const intentCollector = await fundPool.intentCollector();
    console.log(`Intent Collector: ${intentCollector}`);
    
    const totalDeposited = await fundPool.totalDeposited();
    console.log(`Total Deposited: ${ethers.formatUnits(totalDeposited, 6)} USDC`);
    
    const totalWithdrawn = await fundPool.totalWithdrawn();
    console.log(`Total Withdrawn: ${ethers.formatUnits(totalWithdrawn, 6)} USDC`);
    
    // Check if any of the addresses are zero
    if (batchProcessor === ethers.ZeroAddress) {
      console.log("⚠️ BatchProcessor not set!");
    }
    if (intentCollector === ethers.ZeroAddress) {
      console.log("⚠️ IntentCollector not set!");
    }
    
  } catch (error) {
    console.error("❌ Error checking FundPool config:", error.message);
  }
}

main().catch(console.error);