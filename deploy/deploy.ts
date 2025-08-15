import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  
  console.log("🚀 Starting DCA FHE Bot deployment...");
  console.log("📋 Deployer address:", deployer);

  // Step 1: Deploy mock contracts for testing (only on localhost/hardhat)
  let mockPriceFeed: any;
  let mockRouter: any;
  let mockUSDC: any;
  let wethAddress: string;

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("🔧 Deploying mock contracts for testing...");
    
    mockPriceFeed = await deploy("MockPriceFeed", {
      from: deployer,
      log: true,
    });
    console.log("✅ MockPriceFeed deployed at:", mockPriceFeed.address);

    mockRouter = await deploy("MockUniswapRouter", {
      from: deployer,
      log: true,
    });
    console.log("✅ MockUniswapRouter deployed at:", mockRouter.address);

    mockUSDC = await deploy("MockERC20", {
      from: deployer,
      args: ["USD Coin", "USDC", 6],
      log: true,
    });
    console.log("✅ MockUSDC deployed at:", mockUSDC.address);

    wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Mainnet WETH for testing
  } else {
    // For Sepolia and other networks, use real contract addresses
    console.log("🌐 Using real contract addresses for", hre.network.name);
    
    if (hre.network.name === "sepolia") {
      // Sepolia testnet addresses
      mockPriceFeed = { address: "0x694AA1769357215DE4FAC081bf1f309aDC325306" }; // ETH/USD
      mockRouter = { address: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E" }; // Uniswap V3 SwapRouter
      mockUSDC = { address: "0xA0b86a33E6417c8f6C89c35239E6C5B5E6b3d5f7".toLowerCase() }; // Sepolia USDC (example)
      wethAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Sepolia WETH
    } else {
      throw new Error(`Network ${hre.network.name} not supported. Please configure contract addresses.`);
    }
  }

  // Step 2: Deploy FundPool
  console.log("💰 Deploying FundPool...");
  const fundPool = await deploy("FundPool", {
    from: deployer,
    args: [
      mockUSDC.address, // USDC token
      deployer          // owner
    ],
    log: true,
  });
  console.log("✅ FundPool deployed at:", fundPool.address);

  // Step 3: Deploy IntentCollector
  console.log("📝 Deploying IntentCollector...");
  const intentCollector = await deploy("IntentCollector", {
    from: deployer,
    args: [deployer], // owner
    log: true,
  });
  console.log("✅ IntentCollector deployed at:", intentCollector.address);

  // Step 4: Deploy ConfidentialToken (cETH)
  console.log("🔐 Deploying ConfidentialToken...");
  const confidentialToken = await deploy("ConfidentialToken", {
    from: deployer,
    args: [
      "Confidential ETH",
      "cETH", 
      18,
      wethAddress, // underlying token (WETH)
      deployer     // owner
    ],
    log: true,
  });
  console.log("✅ ConfidentialToken deployed at:", confidentialToken.address);

  // Step 5: Deploy BatchProcessor
  console.log("⚡ Deploying BatchProcessor...");
  const batchProcessor = await deploy("BatchProcessor", {
    from: deployer,
    args: [
      intentCollector.address,
      confidentialToken.address,
      mockPriceFeed.address,
      mockRouter.address,
      mockUSDC.address,
      wethAddress,
      deployer // owner
    ],
    log: true,
  });
  console.log("✅ BatchProcessor deployed at:", batchProcessor.address);

  // Step 6: Configure contract permissions
  console.log("🔧 Configuring contract permissions...");
  
  const fundPoolContract = await hre.ethers.getContractAt("FundPool", fundPool.address);
  const intentCollectorContract = await hre.ethers.getContractAt("IntentCollector", intentCollector.address);
  const confidentialTokenContract = await hre.ethers.getContractAt("ConfidentialToken", confidentialToken.address);
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

  // Set BatchProcessor as authorized in ConfidentialToken
  const setBatchProcessorTx2 = await confidentialTokenContract.setBatchProcessor(batchProcessor.address);
  await setBatchProcessorTx2.wait();
  console.log("✅ ConfidentialToken configured with BatchProcessor");

  // Step 7: Initialize mock contracts (for testing networks only)
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("🛠️ Initializing mock contracts...");
    
    const mockPriceFeedContract = await hre.ethers.getContractAt("MockPriceFeed", mockPriceFeed.address);
    const mockUSDCContract = await hre.ethers.getContractAt("MockERC20", mockUSDC.address);
    const mockRouterContract = await hre.ethers.getContractAt("MockUniswapRouter", mockRouter.address);
    
    // Set initial ETH price to $1800
    await mockPriceFeedContract.setLatestRoundData(
      1, // roundId
      180000000000, // $1800 with 8 decimals
      Math.floor(Date.now() / 1000) - 100, // startedAt
      Math.floor(Date.now() / 1000), // updatedAt
      1 // answeredInRound
    );
    console.log("✅ MockPriceFeed initialized with ETH price: $1800");

    // Set mock router to return 1 ETH for swaps
    await mockRouterContract.setSwapResult(hre.ethers.parseEther("1"));
    console.log("✅ MockUniswapRouter configured");

    // Mint some USDC to users for testing
    const signers = await hre.ethers.getSigners();
    if (signers.length > 1) {
      await mockUSDCContract.mint(signers[1].address, hre.ethers.parseUnits("10000", 6)); // 10,000 USDC to user 1
      console.log("✅ Minted 10,000 USDC to test user for deposits");
    }
  }

  // Step 8: Display deployment summary
  console.log("\n🎉 DCA FHE Bot deployment completed!");
  console.log("📋 Deployment Summary:");
  console.log("├── FundPool:", fundPool.address);
  console.log("├── IntentCollector:", intentCollector.address);
  console.log("├── ConfidentialToken:", confidentialToken.address);
  console.log("├── BatchProcessor:", batchProcessor.address);
  
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("├── MockPriceFeed:", mockPriceFeed.address);
    console.log("├── MockUniswapRouter:", mockRouter.address);
    console.log("└── MockUSDC:", mockUSDC.address);
  } else {
    console.log("├── PriceFeed:", mockPriceFeed.address);
    console.log("├── UniswapRouter:", mockRouter.address);
    console.log("└── USDC Token:", mockUSDC.address);
  }
  
  console.log("\n📖 Next Steps:");
  console.log("1. Deposit funds to FundPool before submitting intents:");
  console.log("   - npx hardhat task:deposit --network", hre.network.name, "--amount 1000");
  console.log("2. Submit DCA intents:");
  console.log("   - npx hardhat task:submit-intent --network", hre.network.name, "--budget 500 --trades 10");
  console.log("3. Check system status:");
  console.log("   - npx hardhat task:batch-status --network", hre.network.name);
  console.log("   - npx hardhat task:fund-balance --network", hre.network.name);
  
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("4. Verify contracts on Etherscan:");
    console.log("   - npx hardhat verify --network", hre.network.name, fundPool.address, mockUSDC.address, deployer);
    console.log("   - npx hardhat verify --network", hre.network.name, intentCollector.address, deployer);
    console.log("   - npx hardhat verify --network", hre.network.name, confidentialToken.address, '"Confidential ETH"', '"cETH"', '18', wethAddress, deployer);
    console.log("   - npx hardhat verify --network", hre.network.name, batchProcessor.address, intentCollector.address, confidentialToken.address, mockPriceFeed.address, mockRouter.address, mockUSDC.address, wethAddress, deployer);
  }
};

export default func;
func.id = "deploy_dca_fhe_bot";
func.tags = ["DCAFHEBot", "FundPool", "IntentCollector", "ConfidentialToken", "BatchProcessor"];
