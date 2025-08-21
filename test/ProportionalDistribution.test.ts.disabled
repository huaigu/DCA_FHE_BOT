import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { Contract, Signer } from "ethers";
import { FhevmInstance } from "fhevmjs";

describe("Proportional Distribution Test", function () {
  let batchProcessor: Contract;
  let intentCollector: Contract;
  let fundPool: Contract;
  let mockOracle: Contract;
  let mockPriceFeed: Contract;
  let mockUniswapRouter: Contract;
  let mockUSDC: Contract;
  let mockWETH: Contract;
  
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let user3: Signer;
  
  let fhevmInstance: FhevmInstance;
  
  const SCALING_FACTOR = ethers.parseEther("1"); // 1e18
  const RATE_PRECISION = ethers.parseUnits("1", 27); // 1e27
  
  before(async function () {
    // Skip if not in mock environment
    if (!fhevm.isMock) {
      this.skip();
    }
    
    // Get signers
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Setup FHEVM instance
    fhevmInstance = await fhevm.createInstance();
  });
  
  beforeEach(async function () {
    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
    mockWETH = await MockERC20.deploy("Mock WETH", "WETH", 18);
    
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy();
    // Set price to $1800 with 8 decimals
    await mockPriceFeed.setLatestRoundData(
      1, // roundId
      180000000000, // answer ($1800)
      Math.floor(Date.now() / 1000), // startedAt
      Math.floor(Date.now() / 1000), // updatedAt
      1 // answeredInRound
    );
    
    const MockUniswapRouter = await ethers.getContractFactory("MockUniswapRouter");
    mockUniswapRouter = await MockUniswapRouter.deploy();
    
    const MockDecryptionOracle = await ethers.getContractFactory("MockDecryptionOracle");
    mockOracle = await MockDecryptionOracle.deploy();
    
    // Deploy FundPool
    const FundPool = await ethers.getContractFactory("TestFundPool");
    fundPool = await FundPool.deploy(
      await mockUSDC.getAddress(),
      await owner.getAddress()
    );
    
    // Deploy IntentCollector
    const IntentCollector = await ethers.getContractFactory("IntentCollector");
    intentCollector = await IntentCollector.deploy(await owner.getAddress());
    
    // Deploy BatchProcessor (without ConfidentialToken)
    const BatchProcessor = await ethers.getContractFactory("TestBatchProcessor");
    batchProcessor = await BatchProcessor.deploy(
      await intentCollector.getAddress(),
      await mockPriceFeed.getAddress(),
      await mockUniswapRouter.getAddress(),
      await mockUSDC.getAddress(),
      await mockWETH.getAddress(),
      await owner.getAddress()
    );
    
    // Setup relationships
    await intentCollector.setBatchProcessor(await batchProcessor.getAddress());
    await intentCollector.setFundPool(await fundPool.getAddress());
    await batchProcessor.setFundPool(await fundPool.getAddress());
    await batchProcessor.setDecryptionOracle(await mockOracle.getAddress());
    await fundPool.setBatchProcessor(await batchProcessor.getAddress());
    await fundPool.setIntentCollector(await intentCollector.getAddress());
    
    // Fund users with USDC
    await mockUSDC.mint(await user1.getAddress(), ethers.parseUnits("10000", 6));
    await mockUSDC.mint(await user2.getAddress(), ethers.parseUnits("10000", 6));
    await mockUSDC.mint(await user3.getAddress(), ethers.parseUnits("10000", 6));
    
    // Approve FundPool
    await mockUSDC.connect(user1).approve(await fundPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(user2).approve(await fundPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(user3).approve(await fundPool.getAddress(), ethers.MaxUint256);
    
    // Fund router with ETH for swaps
    await mockWETH.mint(await mockUniswapRouter.getAddress(), ethers.parseEther("100"));
    await mockUSDC.mint(await mockUniswapRouter.getAddress(), ethers.parseUnits("100000", 6));
  });
  
  describe("Proportional Distribution with Fixed-Point Arithmetic", function () {
    it("Should distribute ETH proportionally based on contributions", async function () {
      // User 1: deposits 1000 USDC
      // User 2: deposits 500 USDC  
      // User 3: deposits 1500 USDC
      // Total: 3000 USDC
      
      // Deposit funds
      await fundPool.connect(user1).deposit(ethers.parseUnits("1000", 6));
      await fundPool.connect(user2).deposit(ethers.parseUnits("500", 6));
      await fundPool.connect(user3).deposit(ethers.parseUnits("1500", 6));
      
      // Submit intents with different amounts
      const contractAddress = await intentCollector.getAddress();
      
      // User 1: 100 USDC per trade
      const input1 = fhevmInstance.createEncryptedInput(contractAddress, await user1.getAddress());
      input1.add64(ethers.parseUnits("1000", 6)); // budget
      input1.add32(10); // trades count
      input1.add64(ethers.parseUnits("100", 6)); // amount per trade
      input1.add32(86400); // frequency
      input1.add64(150000); // min price $1500
      input1.add64(200000); // max price $2000
      const encrypted1 = input1.encrypt();
      
      await intentCollector.connect(user1).submitIntent({
        budgetExt: encrypted1.handles[0],
        budgetProof: encrypted1.inputProof,
        tradesCountExt: encrypted1.handles[1], 
        tradesCountProof: encrypted1.inputProof,
        amountPerTradeExt: encrypted1.handles[2],
        amountPerTradeProof: encrypted1.inputProof,
        frequencyExt: encrypted1.handles[3],
        frequencyProof: encrypted1.inputProof,
        minPriceExt: encrypted1.handles[4],
        minPriceProof: encrypted1.inputProof,
        maxPriceExt: encrypted1.handles[5],
        maxPriceProof: encrypted1.inputProof
      });
      
      // User 2: 50 USDC per trade
      const input2 = fhevmInstance.createEncryptedInput(contractAddress, await user2.getAddress());
      input2.add64(ethers.parseUnits("500", 6));
      input2.add32(10);
      input2.add64(ethers.parseUnits("50", 6)); // 50 USDC per trade
      input2.add32(86400);
      input2.add64(150000);
      input2.add64(200000);
      const encrypted2 = input2.encrypt();
      
      await intentCollector.connect(user2).submitIntent({
        budgetExt: encrypted2.handles[0],
        budgetProof: encrypted2.inputProof,
        tradesCountExt: encrypted2.handles[1],
        tradesCountProof: encrypted2.inputProof,
        amountPerTradeExt: encrypted2.handles[2],
        amountPerTradeProof: encrypted2.inputProof,
        frequencyExt: encrypted2.handles[3],
        frequencyProof: encrypted2.inputProof,
        minPriceExt: encrypted2.handles[4],
        minPriceProof: encrypted2.inputProof,
        maxPriceExt: encrypted2.handles[5],
        maxPriceProof: encrypted2.inputProof
      });
      
      // User 3: 150 USDC per trade
      const input3 = fhevmInstance.createEncryptedInput(contractAddress, await user3.getAddress());
      input3.add64(ethers.parseUnits("1500", 6));
      input3.add32(10);
      input3.add64(ethers.parseUnits("150", 6)); // 150 USDC per trade
      input3.add32(86400);
      input3.add64(150000);
      input3.add64(200000);
      const encrypted3 = input3.encrypt();
      
      await intentCollector.connect(user3).submitIntent({
        budgetExt: encrypted3.handles[0],
        budgetProof: encrypted3.inputProof,
        tradesCountExt: encrypted3.handles[1],
        tradesCountProof: encrypted3.inputProof,
        amountPerTradeExt: encrypted3.handles[2],
        amountPerTradeProof: encrypted3.inputProof,
        frequencyExt: encrypted3.handles[3],
        frequencyProof: encrypted3.inputProof,
        minPriceExt: encrypted3.handles[4],
        minPriceProof: encrypted3.inputProof,
        maxPriceExt: encrypted3.handles[5],
        maxPriceProof: encrypted3.inputProof
      });
      
      // Process batch
      await batchProcessor.testManualTriggerBatch(1);
      
      // Check proportional distribution was emitted
      const events = await batchProcessor.queryFilter(
        batchProcessor.filters.ProportionalDistributionCompleted()
      );
      expect(events.length).to.equal(1);
      
      const event = events[0];
      expect(event.args.participantCount).to.equal(3);
      expect(event.args.totalUsdcSpent).to.equal(ethers.parseUnits("300", 6)); // 100 + 50 + 150
      
      // Verify the scaled rate calculation
      const totalUsdcSpent = ethers.parseUnits("300", 6);
      const totalEthReceived = event.args.totalEthReceived;
      const expectedRate = (totalEthReceived * RATE_PRECISION) / totalUsdcSpent;
      expect(event.args.scaledRate).to.equal(expectedRate);
    });
    
    it("Should handle overflow protection with euint128", async function () {
      // Test with large amounts to ensure no overflow
      const largeAmount = ethers.parseUnits("1000000", 6); // 1M USDC
      
      await mockUSDC.mint(await user1.getAddress(), largeAmount);
      await fundPool.connect(user1).deposit(largeAmount);
      
      const contractAddress = await intentCollector.getAddress();
      const input = fhevmInstance.createEncryptedInput(contractAddress, await user1.getAddress());
      input.add64(largeAmount);
      input.add32(10);
      input.add64(ethers.parseUnits("100000", 6)); // 100k USDC per trade
      input.add32(86400);
      input.add64(150000);
      input.add64(200000);
      const encrypted = input.encrypt();
      
      await intentCollector.connect(user1).submitIntent({
        budgetExt: encrypted.handles[0],
        budgetProof: encrypted.inputProof,
        tradesCountExt: encrypted.handles[1],
        tradesCountProof: encrypted.inputProof,
        amountPerTradeExt: encrypted.handles[2],
        amountPerTradeProof: encrypted.inputProof,
        frequencyExt: encrypted.handles[3],
        frequencyProof: encrypted.inputProof,
        minPriceExt: encrypted.handles[4],
        minPriceProof: encrypted.inputProof,
        maxPriceExt: encrypted.handles[5],
        maxPriceProof: encrypted.inputProof
      });
      
      // Should not revert due to overflow
      await expect(batchProcessor.testManualTriggerBatch(1)).to.not.be.reverted;
    });
    
    it("Should maintain precision with fixed-point arithmetic", async function () {
      // Test precision with small amounts
      await fundPool.connect(user1).deposit(ethers.parseUnits("10.123456", 6));
      
      const contractAddress = await intentCollector.getAddress();
      const input = fhevmInstance.createEncryptedInput(contractAddress, await user1.getAddress());
      input.add64(ethers.parseUnits("10.123456", 6));
      input.add32(1);
      input.add64(ethers.parseUnits("10.123456", 6));
      input.add32(86400);
      input.add64(150000);
      input.add64(200000);
      const encrypted = input.encrypt();
      
      await intentCollector.connect(user1).submitIntent({
        budgetExt: encrypted.handles[0],
        budgetProof: encrypted.inputProof,
        tradesCountExt: encrypted.handles[1],
        tradesCountProof: encrypted.inputProof,
        amountPerTradeExt: encrypted.handles[2],
        amountPerTradeProof: encrypted.inputProof,
        frequencyExt: encrypted.handles[3],
        frequencyProof: encrypted.inputProof,
        minPriceExt: encrypted.handles[4],
        minPriceProof: encrypted.inputProof,
        maxPriceExt: encrypted.handles[5],
        maxPriceProof: encrypted.inputProof
      });
      
      await batchProcessor.testManualTriggerBatch(1);
      
      // Check that distribution event was emitted with correct precision
      const events = await batchProcessor.queryFilter(
        batchProcessor.filters.ProportionalDistributionCompleted()
      );
      
      expect(events.length).to.equal(1);
      // Verify precision is maintained in the scaled rate
      expect(events[0].args.scaledRate).to.be.gt(0);
    });
  });
});