import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  
  console.log("🚀 Starting Simplified DCA FHE Bot deployment...");
  console.log("📋 Deployer address:", deployer);

  // Contract addresses for Sepolia
  let mockPriceFeed: any;
  let mockRouter: any;
  let mockUSDC: any;
  let wethAddress: string;

  if (hre.network.name === "sepolia") {
    // Sepolia testnet addresses with corrected USDC
    mockPriceFeed = { address: "0x694AA1769357215DE4FAC081bf1f309aDC325306" }; // ETH/USD
    mockRouter = { address: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E" }; // Uniswap V3 SwapRouter
    mockUSDC = { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" }; // Verified Sepolia USDC
    wethAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Sepolia WETH
  } else {
    throw new Error(`Network ${hre.network.name} not supported. Please configure contract addresses.`);
  }

  console.log("🌐 Using verified contract addresses for", hre.network.name);
  console.log("📋 USDC Address:", mockUSDC.address);

  // Step 1: Deploy FundPool
  console.log("\n💰 Deploying FundPool...");
  const fundPool = await deploy("FundPool", {
    from: deployer,
    args: [
      mockUSDC.address, // USDC token
      deployer          // owner
    ],
    log: true,
  });
  console.log("✅ FundPool deployed at:", fundPool.address);

  // Step 2: Deploy IntentCollector
  console.log("\n📝 Deploying IntentCollector...");
  const intentCollector = await deploy("IntentCollector", {
    from: deployer,
    args: [deployer], // owner
    log: true,
  });
  console.log("✅ IntentCollector deployed at:", intentCollector.address);

  // Step 3: Deploy BatchProcessor
  console.log("\n⚡ Deploying BatchProcessor...");
  const batchProcessor = await deploy("BatchProcessor", {
    from: deployer,
    args: [
      intentCollector.address,
      mockPriceFeed.address,
      mockRouter.address,
      mockUSDC.address,
      wethAddress,
      deployer // owner
    ],
    log: true,
  });
  console.log("✅ BatchProcessor deployed at:", batchProcessor.address);

  // Step 4: Configure contract permissions
  console.log("\n🔧 Configuring contract permissions...");
  
  const fundPoolContract = await hre.ethers.getContractAt("FundPool", fundPool.address);
  const intentCollectorContract = await hre.ethers.getContractAt("IntentCollector", intentCollector.address);
  const batchProcessorContract = await hre.ethers.getContractAt("BatchProcessor", batchProcessor.address);
  
  // Set FundPool in IntentCollector
  const setFundPoolTx1 = await intentCollectorContract.setFundPool(fundPool.address);
  await setFundPoolTx1.wait();
  console.log("✅ IntentCollector configured with FundPool");
  
  // Set FundPool in BatchProcessor
  const setFundPoolTx2 = await batchProcessorContract.setFundPool(fundPool.address);
  await setFundPoolTx2.wait();
  console.log("✅ BatchProcessor configured with FundPool");
  
  // Set BatchProcessor and IntentCollector in FundPool
  const setBatchProcessorTx3 = await fundPoolContract.setBatchProcessor(batchProcessor.address);
  await setBatchProcessorTx3.wait();
  console.log("✅ FundPool configured with BatchProcessor");
  
  const setIntentCollectorTx = await fundPoolContract.setIntentCollector(intentCollector.address);
  await setIntentCollectorTx.wait();
  console.log("✅ FundPool configured with IntentCollector");
  
  // Set BatchProcessor as authorized in IntentCollector
  const setBatchProcessorTx1 = await intentCollectorContract.setBatchProcessor(batchProcessor.address);
  await setBatchProcessorTx1.wait();
  console.log("✅ IntentCollector configured with BatchProcessor");

  // Step 5: Display deployment summary
  console.log("\n🎉 DCA FHE Bot deployment completed!");
  console.log("📋 Deployment Summary:");
  console.log("├── FundPool:", fundPool.address);
  console.log("├── IntentCollector:", intentCollector.address);
  console.log("├── BatchProcessor:", batchProcessor.address);
  console.log("├── USDC Token:", mockUSDC.address);
  console.log("├── PriceFeed:", mockPriceFeed.address);
  console.log("├── UniswapRouter:", mockRouter.address);
  console.log("└── WETH:", wethAddress);
  
  console.log("\n📖 Next Steps:");
  console.log("1. Update frontend environment variables with these addresses");
  console.log("2. Test deposit functionality:");
  console.log("   - node test-deposit-simple.js");
  
  console.log("\n📋 Environment Variables for Frontend:");
  console.log(`NEXT_PUBLIC_FUND_POOL_ADDRESS=${fundPool.address}`);
  console.log(`NEXT_PUBLIC_INTENT_COLLECTOR_ADDRESS=${intentCollector.address}`);
  console.log(`NEXT_PUBLIC_BATCH_PROCESSOR_ADDRESS=${batchProcessor.address}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${mockUSDC.address}`);
  console.log(`NEXT_PUBLIC_WETH_ADDRESS=${wethAddress}`);
  console.log(`NEXT_PUBLIC_PRICE_FEED_ADDRESS=${mockPriceFeed.address}`);
  console.log(`NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS=${mockRouter.address}`);
};

export default func;
func.id = "deploy_dca_simple";
func.tags = ["DCASimple", "FundPool", "IntentCollector", "BatchProcessor"];