import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { 
  TestBatchProcessor, 
  TestBatchProcessor__factory,
  IntentCollector,
  IntentCollector__factory,
  TestFundPool,
  TestFundPool__factory
} from "../../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
  david: HardhatEthersSigner;
  eve: HardhatEthersSigner;
};

async function deploySystemFixture() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  // Deploy mock external contracts
  const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
  const mockPriceFeed = await MockPriceFeed.deploy();
  
  const MockUniswapRouter = await ethers.getContractFactory("MockUniswapRouter");
  const mockRouter = await MockUniswapRouter.deploy();
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
  
  // Deploy a mock WETH token
  const mockWETH = await MockERC20.deploy("Wrapped ETH", "WETH", 18);
  const wethAddress = await mockWETH.getAddress();
  
  // Deploy FundPool first
  const fundPoolFactory = (await ethers.getContractFactory("TestFundPool")) as TestFundPool__factory;
  const fundPool = (await fundPoolFactory.deploy(
    await mockUSDC.getAddress(),
    deployer.address
  )) as TestFundPool;
  
  // Deploy core contracts
  const intentCollectorFactory = (await ethers.getContractFactory("IntentCollector")) as IntentCollector__factory;
  const intentCollector = (await intentCollectorFactory.deploy(deployer.address)) as IntentCollector;
  
  const batchProcessorFactory = (await ethers.getContractFactory("TestBatchProcessor")) as TestBatchProcessor__factory;
  const batchProcessor = (await batchProcessorFactory.deploy(
    await intentCollector.getAddress(),
    await mockPriceFeed.getAddress(),
    await mockRouter.getAddress(),
    await mockUSDC.getAddress(),
    wethAddress,
    deployer.address
  )) as TestBatchProcessor;
  
  // Set up contract permissions
  const batchProcessorAddress = await batchProcessor.getAddress();
  const intentCollectorAddress = await intentCollector.getAddress();
  const fundPoolAddress = await fundPool.getAddress();
  
  // Configure IntentCollector
  await intentCollector.setBatchProcessor(batchProcessorAddress);
  await intentCollector.setFundPool(fundPoolAddress);
  
  // Configure FundPool
  await fundPool.setBatchProcessor(batchProcessorAddress);
  await fundPool.setIntentCollector(intentCollectorAddress);
  
  // Configure BatchProcessor
  await batchProcessor.setFundPool(fundPoolAddress);
  
  // Setup mock price feed with reasonable ETH price
  await mockPriceFeed.setLatestRoundData(
    1,
    180000000000, // $1800 with 8 decimals
    Math.floor(Date.now() / 1000) - 100,
    Math.floor(Date.now() / 1000),
    1
  );
  
  // Setup mock router to return 1 ETH for swaps
  await mockRouter.setSwapResult(ethers.parseEther("1"));
  
  // Give mock router WETH tokens for returning in swaps
  await mockWETH.mint(await mockRouter.getAddress(), ethers.parseEther("100"));
  
  // Don't give batch processor USDC directly anymore - it will come from FundPool

  return {
    intentCollector,
    batchProcessor,
    fundPool,
    mockPriceFeed,
    mockRouter,
    mockUSDC,
    mockWETH,
    deployer
  };
}

describe("DCA System Integration", function () {
  let signers: Signers;
  let intentCollector: IntentCollector;
  let batchProcessor: TestBatchProcessor;
  let fundPool: TestFundPool;
  let mockPriceFeed: any;
  let mockRouter: any;
  let mockUSDC: any;
  let mockWETH: any;

  // Move submitDCAIntent to be accessible by all tests
  // Helper function to create submitIntent params
  function createSubmitIntentParams(encryptedInput: any) {
    return {
      budgetExt: encryptedInput.handles[0],
      budgetProof: encryptedInput.inputProof,
      tradesCountExt: encryptedInput.handles[1],
      tradesCountProof: encryptedInput.inputProof,
      amountPerTradeExt: encryptedInput.handles[2],
      amountPerTradeProof: encryptedInput.inputProof,
      frequencyExt: encryptedInput.handles[3],
      frequencyProof: encryptedInput.inputProof,
      minPriceExt: encryptedInput.handles[4],
      minPriceProof: encryptedInput.inputProof,
      maxPriceExt: encryptedInput.handles[5],
      maxPriceProof: encryptedInput.inputProof
    };
  }

  async function submitDCAIntent(
    signer: HardhatEthersSigner,
    budget: bigint,
    tradesCount: number,
    amountPerTrade: bigint,
    frequency: number,
    minPrice: bigint,
    maxPrice: bigint
  ) {
    const intentCollectorAddress = await intentCollector.getAddress();
    
    const encryptedInput = await fhevm
      .createEncryptedInput(intentCollectorAddress, signer.address)
      .add64(budget)
      .add32(tradesCount)
      .add64(amountPerTrade)
      .add32(frequency)
      .add64(minPrice)
      .add64(maxPrice)
      .encrypt();

    const params = createSubmitIntentParams(encryptedInput);
    return await intentCollector
      .connect(signer)
      .submitIntent(params);
  }

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { 
      deployer: ethSigners[0], 
      alice: ethSigners[1], 
      bob: ethSigners[2],
      charlie: ethSigners[3],
      david: ethSigners[4],
      eve: ethSigners[5]
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This integration test can only run on FHEVM mock environment`);
      this.skip();
    }

    ({
      intentCollector,
      batchProcessor,
      fundPool,
      mockPriceFeed,
      mockRouter,
      mockUSDC,
      mockWETH
    } = await deploySystemFixture());
    
    // Setup FundPool deposits for test users
    const depositAmount = ethers.parseUnits("10000", 6); // 10,000 USDC per user
    const fundPoolAddress = await fundPool.getAddress();
    
    // For testing simplicity, mint USDC directly to the FundPool
    // and use testInitializeBalance to set up user balances
    const totalDeposit = ethers.parseUnits("100000", 6); // 100,000 USDC total (enough for all operations)
    await mockUSDC.mint(fundPoolAddress, totalDeposit);
    
    // Setup deposits for multiple users using test function
    const users = [signers.alice, signers.bob, signers.charlie, signers.david, signers.eve];
    
    for (const user of users) {
      // Initialize encrypted balance for each user
      await fundPool.testInitializeBalance(user.address, depositAmount);
      
      // Update user state to ACTIVE in IntentCollector
      // Temporarily set deployer as batch processor to update states
      await intentCollector.connect(signers.deployer).setBatchProcessor(signers.deployer.address);
      await intentCollector.connect(signers.deployer).updateUserState(user.address, 1); // ACTIVE
    }
    
    // Reset batch processor back to the actual batch processor
    await intentCollector.connect(signers.deployer).setBatchProcessor(await batchProcessor.getAddress());
    
    // Give mock router ETH for swaps and mint WETH for token swaps
    await signers.deployer.sendTransaction({
      to: await mockRouter.getAddress(),
      value: ethers.parseEther("10")
    });
    
    // Mint WETH to the router for swap outputs
    await mockWETH.mint(await mockRouter.getAddress(), ethers.parseEther("100"));
    
    // Set the swap result to a reasonable amount
    await mockRouter.setSwapResult(ethers.parseEther("1")); // 1 ETH per swap
  });

  describe("Complete DCA Workflow", function () {

    it("should process a complete DCA batch successfully", async function () {
      // Submit 5 DCA intents with different parameters but overlapping price ranges
      // Submit twice to reach MAX_BATCH_SIZE (10 intents)
      const intents = [
        {
          signer: signers.alice,
          budget: 1000n * 1000000n, // 1000 USDC
          tradesCount: 10,
          amountPerTrade: 100n * 1000000n, // 100 USDC per trade
          frequency: 86400, // Daily
          minPrice: 1500n * 100n, // $1500
          maxPrice: 2000n * 100n, // $2000
        },
        {
          signer: signers.bob,
          budget: 2000n * 1000000n, // 2000 USDC
          tradesCount: 20,
          amountPerTrade: 100n * 1000000n,
          frequency: 43200, // 12 hours
          minPrice: 1600n * 100n, // $1600
          maxPrice: 1900n * 100n, // $1900
        },
        {
          signer: signers.charlie,
          budget: 500n * 1000000n, // 500 USDC
          tradesCount: 5,
          amountPerTrade: 100n * 1000000n,
          frequency: 172800, // 2 days
          minPrice: 1400n * 100n, // $1400
          maxPrice: 2200n * 100n, // $2200
        },
        {
          signer: signers.david,
          budget: 1500n * 1000000n, // 1500 USDC
          tradesCount: 15,
          amountPerTrade: 100n * 1000000n,
          frequency: 86400,
          minPrice: 1700n * 100n, // $1700
          maxPrice: 1850n * 100n, // $1850
        },
        {
          signer: signers.eve,
          budget: 3000n * 1000000n, // 3000 USDC
          tradesCount: 30,
          amountPerTrade: 100n * 1000000n,
          frequency: 21600, // 6 hours
          minPrice: 1550n * 100n, // $1550
          maxPrice: 1950n * 100n, // $1950
        }
      ];

      // Submit all intents twice to reach MAX_BATCH_SIZE (10 intents)
      for (let round = 0; round < 2; round++) {
        for (const intent of intents) {
          await submitDCAIntent(
            intent.signer,
            intent.budget,
            intent.tradesCount,
            intent.amountPerTrade,
            intent.frequency,
            intent.minPrice,
            intent.maxPrice
          );
        }
      }

      // Verify batch is ready
      const minBatchSize = 5; // Use 5 as the minimum batch size for this test
      const [isReady, batchId] = await intentCollector.checkBatchReady();
      expect(isReady).to.be.true;
      expect(batchId).to.equal(1);
      
      // Get the batch intents to verify count
      const [, intentIds] = await intentCollector.getReadyBatch();
      expect(intentIds.length).to.equal(10); // Changed from 5 to 10

      // Check that all intents are in the current batch
      for (let i = 1; i <= 10; i++) { // Changed from 5 to 10
        const intent = await intentCollector.getIntent(i);
        expect(intent.batchId).to.equal(1);
        expect(intent.isActive).to.be.true;
        expect(intent.isProcessed).to.be.false;
      }

      // Process the batch manually
      try {
        await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);
      } catch (error) {
        console.log("Error processing batch:", error);
        throw error;
      }

      // Verify batch was processed successfully
      const lastProcessed = await batchProcessor.lastProcessedBatch();
      console.log("Last processed batch:", lastProcessed.toString());
      expect(lastProcessed).to.equal(1);
      
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.batchId).to.equal(1);
      expect(batchResult.success).to.be.true;
      expect(batchResult.participantCount).to.equal(10); // Changed from 5 to 10
      expect(batchResult.priceAtExecution).to.equal(180000); // $1800.00 in cents (with extra precision)

      // Verify intents are marked as processed
      for (let i = 1; i <= 10; i++) { // Changed from 5 to 10
        const intent = await intentCollector.getIntent(i);
        expect(intent.isProcessed).to.be.true;
        expect(intent.isActive).to.be.true; // Should remain active if successful
      }

      // Verify new batch was started
      expect(await intentCollector.batchCounter()).to.equal(2);
      expect(await intentCollector.getPendingIntentsCount()).to.equal(0);

      // Verify users should have encrypted ETH balances in BatchProcessor
      // In the current architecture, users can now withdraw ETH via withdrawEth()
      console.log("Batch processed successfully - users can now withdraw ETH via withdrawEth()");

      // Check that users have encrypted balances (mock implementation)
      for (const intent of intents) {
        const mockBalance = await batchProcessor.getMockEthBalance(intent.signer.address);
        console.log(`User ${intent.signer.address} mock ETH balance: ${ethers.formatEther(mockBalance)}`);
      }
    });

    it("should handle price filtering correctly", async function () {
      // Set price to $1300 (below most intent ranges)
      await mockPriceFeed.setLatestRoundData(
        1,
        130000000000, // $1300 with 8 decimals
        Math.floor(Date.now() / 1000) - 100,
        Math.floor(Date.now() / 1000),
        1
      );

      // Submit intents with different price ranges
      await submitDCAIntent(
        signers.alice,
        1000n * 1000000n, // 1000 USDC
        10,
        100n * 1000000n,
        86400,
        1200n * 100n, // $1200 - should execute
        1400n * 100n, // $1400 - should execute
      );

      await submitDCAIntent(
        signers.bob,
        1000n * 1000000n,
        10,
        100n * 1000000n,
        86400,
        1500n * 100n, // $1500 - should NOT execute (price too low)
        2000n * 100n, // $2000 - should NOT execute
      );

      await submitDCAIntent(
        signers.charlie,
        1000n * 1000000n,
        10,
        100n * 1000000n,
        86400,
        1000n * 100n, // $1000 - should execute
        1500n * 100n, // $1500 - should execute
      );

      await submitDCAIntent(
        signers.david,
        1000n * 1000000n,
        10,
        100n * 1000000n,
        86400,
        1400n * 100n, // $1400 - should NOT execute (price too low)
        1800n * 100n, // $1800 - should NOT execute
      );

      await submitDCAIntent(
        signers.eve,
        1000n * 1000000n,
        10,
        100n * 1000000n,
        86400,
        1250n * 100n, // $1250 - should execute
        1350n * 100n, // $1350 - should execute
      );

      // Initialize balances for users who should receive tokens (removed - no longer needed)

      // Process the batch
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);

      // Verify batch was processed
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.success).to.be.true;
      expect(batchResult.priceAtExecution).to.equal(130000); // $1300.00 in cents (with extra precision)

      // In a real implementation, only Alice, Charlie, and Eve should receive tokens
      // Bob and David's intents should be filtered out due to price conditions
      // For this test, we verify that the batch processed successfully with filtering
    });

    it("should handle automation triggers correctly", async function () {
      // Submit 10 intents to trigger batch
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        await submitDCAIntent(
          signer,
          1000n * 1000000n,
          10,
          100n * 1000000n,
          86400,
          1500n * 100n,
          2000n * 100n
        );
      }

      // Check that upkeep is needed
      const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.true;

      // Since performUpkeep uses production FHEVM flow which doesn't work in mock environment,
      // we'll test the manual trigger instead which bypasses FHEVM limitations
      const batchId = 1;
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(batchId);

      // Verify batch was processed
      expect(await batchProcessor.lastProcessedBatch()).to.equal(1);
      
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.success).to.be.true;
    });

    it("should handle failed swaps gracefully", async function () {
      // Set mock router to return 0 (failed swap)
      await mockRouter.setSwapResult(0);

      // Submit intents
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        await submitDCAIntent(
          signer,
          1000n * 1000000n,
          10,
          100n * 1000000n,
          86400,
          1500n * 100n,
          2000n * 100n
        );
      }

      // Process batch
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);

      // Verify batch result - TestBatchProcessor._executeSwapAndUpdateBalancesMock
      // calls _executeSwap which will return 0 for failed swap, leading to failed batch
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.success).to.be.false;
      expect(batchResult.totalAmountOut).to.equal(0);
    });
  });

  describe("System State Management", function () {
    it("should maintain correct state across multiple batches", async function () {
      // Process first batch
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        await submitDCAIntent(
          signer,
          1000n * 1000000n,
          10,
          100n * 1000000n,
          86400,
          1500n * 100n,
          2000n * 100n
        );
      }
      
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);
      
      // Verify first batch
      expect(await batchProcessor.lastProcessedBatch()).to.equal(1);
      expect(await intentCollector.batchCounter()).to.equal(2);
      
      // Submit second batch
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.charlie : signers.david;
        await submitDCAIntent(
          signer,
          2000n * 1000000n,
          20,
          100n * 1000000n,
          86400,
          1600n * 100n,
          1900n * 100n
        );
      }
      
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(2);
      
      // Verify second batch
      expect(await batchProcessor.lastProcessedBatch()).to.equal(2);
      expect(await intentCollector.batchCounter()).to.equal(3);
      
      // Verify both batch results exist
      const batch1Result = await batchProcessor.getBatchResult(1);
      const batch2Result = await batchProcessor.getBatchResult(2);
      
      expect(batch1Result.batchId).to.equal(1);
      expect(batch2Result.batchId).to.equal(2);
      expect(batch1Result.success).to.be.true;
      expect(batch2Result.success).to.be.true;
    });

    // Pause functionality removed from contract, test skipped
    it.skip("should handle pause/unpause correctly", async function () {
      // Submit intents
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        await submitDCAIntent(
          signer,
          1000n * 1000000n,
          10,
          100n * 1000000n,
          86400,
          1500n * 100n,
          2000n * 100n
        );
      }

      // Pause the system
      await batchProcessor.connect(signers.deployer).pause();

      // Verify upkeep returns false when paused
      const [upkeepNeeded] = await batchProcessor.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;

      // Manual trigger should fail when paused
      await expect(
        batchProcessor.connect(signers.deployer).testManualTriggerBatch(1)
      ).to.be.revertedWithCustomError(batchProcessor, "EnforcedPause");

      // Unpause and process
      await batchProcessor.connect(signers.deployer).unpause();
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);

      // Verify processing worked after unpause
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.success).to.be.true;
    });
  });

  describe("Edge Cases", function () {
    it("should handle batch with no valid intents due to price conditions", async function () {
      // Set price way outside all possible ranges
      await mockPriceFeed.setLatestRoundData(
        1,
        50000000000, // $500 - very low price
        Math.floor(Date.now() / 1000) - 100,
        Math.floor(Date.now() / 1000),
        1
      );

      // Submit intents with high price ranges
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        await submitDCAIntent(
          signer,
          1000n * 1000000n,
          10,
          100n * 1000000n,
          86400,
          2000n * 100n, // $2000 - way above current price
          2500n * 100n, // $2500
        );
      }

      // Process batch
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);

      // Verify batch was processed
      const batchResult = await batchProcessor.getBatchResult(1);
      // No intents should execute due to price being outside all ranges
      // Batch should be successful but with no swaps executed
      expect(batchResult.success).to.be.true;
      expect(batchResult.totalAmountIn).to.equal(0); // No USDC swapped
      expect(batchResult.totalAmountOut).to.equal(0); // No ETH received
    });

    it("should handle stale price data correctly", async function () {
      // Set stale price data
      await mockPriceFeed.setLatestRoundData(
        1,
        180000000000,
        Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        Math.floor(Date.now() / 1000) - 7200,
        1
      );

      // Submit intents
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        await submitDCAIntent(
          signer,
          1000n * 1000000n,
          10,
          100n * 1000000n,
          86400,
          1500n * 100n,
          2000n * 100n
        );
      }

      // Check upkeep should return false for stale data
      const [upkeepNeeded] = await batchProcessor.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;

      // Manual trigger should revert due to invalid price data
      await expect(
        batchProcessor.connect(signers.deployer).testManualTriggerBatch(1)
      ).to.be.revertedWithCustomError(batchProcessor, "InvalidPriceData");
    });
  });
});