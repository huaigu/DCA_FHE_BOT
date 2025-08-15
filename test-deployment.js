const { ethers } = require("hardhat");

async function testDeployment() {
    console.log("🧪 Testing DCA FHE Bot deployment...");
    
    // Get deployed contract addresses (from successful deployment)
    const fundPoolAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
    const intentCollectorAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
    const confidentialTokenAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
    const batchProcessorAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
    const mockUSDCAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const mockPriceFeedAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    
    // Get contract instances
    const fundPool = await ethers.getContractAt("FundPool", fundPoolAddress);
    const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorAddress);
    const confidentialToken = await ethers.getContractAt("ConfidentialToken", confidentialTokenAddress);
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorAddress);
    const mockUSDC = await ethers.getContractAt("MockERC20", mockUSDCAddress);
    const mockPriceFeed = await ethers.getContractAt("MockPriceFeed", mockPriceFeedAddress);
    
    console.log("✅ Contract instances created");
    
    // Test 1: Check contract owners
    console.log("\n📋 Contract Ownership:");
    console.log("FundPool owner:", await fundPool.owner());
    console.log("IntentCollector owner:", await intentCollector.owner());
    console.log("BatchProcessor owner:", await batchProcessor.owner());
    console.log("ConfidentialToken owner:", await confidentialToken.owner());
    
    // Test 2: Check configurations
    console.log("\n🔧 Contract Configurations:");
    console.log("FundPool USDC token:", await fundPool.usdcToken());
    console.log("BatchProcessor automation enabled:", await batchProcessor.automationEnabled());
    console.log("IntentCollector batch counter:", await intentCollector.batchCounter());
    
    // Test 3: Check price feed
    console.log("\n💰 Price Feed Test:");
    const priceData = await mockPriceFeed.latestRoundData();
    console.log("Current ETH price:", ethers.formatUnits(priceData[1], 8), "USD");
    
    // Test 4: Check USDC
    console.log("\n🪙 USDC Token Test:");
    const [deployer] = await ethers.getSigners();
    const usdcBalance = await mockUSDC.balanceOf(deployer.address);
    console.log("Deployer USDC balance:", ethers.formatUnits(usdcBalance, 6), "USDC");
    console.log("USDC total supply:", ethers.formatUnits(await mockUSDC.totalSupply(), 6), "USDC");
    
    // Test 5: Check batch processing readiness
    console.log("\n⚡ Batch Processing Status:");
    const checkUpkeepResult = await batchProcessor.checkUpkeep("0x");
    console.log("Upkeep needed:", checkUpkeepResult[0]);
    console.log("Perform data length:", checkUpkeepResult[1].length);
    
    console.log("\n🎉 All deployment tests passed successfully!");
    console.log("\n📋 Contract Addresses Summary:");
    console.log("├── FundPool:", fundPoolAddress);
    console.log("├── IntentCollector:", intentCollectorAddress);
    console.log("├── ConfidentialToken:", confidentialTokenAddress);
    console.log("├── BatchProcessor:", batchProcessorAddress);
    console.log("├── MockUSDC:", mockUSDCAddress);
    console.log("└── MockPriceFeed:", mockPriceFeedAddress);
}

testDeployment().catch(console.error);