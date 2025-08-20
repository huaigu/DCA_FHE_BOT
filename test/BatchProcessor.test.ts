import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import {
  TestBatchProcessor,
  TestBatchProcessor__factory,
  IntentCollector,
  IntentCollector__factory,
  TestFundPool,
  TestFundPool__factory,
} from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

// Mock contracts for testing
const MockPriceFeed = {
  async deploy() {
    const factory = await ethers.getContractFactory("MockPriceFeed");
    return await factory.deploy();
  },
};

const MockUniswapRouter = {
  async deploy() {
    const factory = await ethers.getContractFactory("MockUniswapRouter");
    return await factory.deploy();
  },
};

const MockUSDC = {
  async deploy() {
    const factory = await ethers.getContractFactory("MockERC20");
    return await factory.deploy("USD Coin", "USDC", 6);
  },
};

const MockWETH = {
  async deploy() {
    const factory = await ethers.getContractFactory("MockERC20");
    return await factory.deploy("Wrapped ETH", "WETH", 18);
  },
};

describe("BatchProcessor", function () {
  let signers: Signers;
  let batchProcessor: TestBatchProcessor;
  let intentCollector: IntentCollector;
  let fundPool: TestFundPool;
  let mockPriceFeed: any;
  let mockRouter: any;
  let mockUSDC: any;
  let mockWETH: any;
  let batchProcessorAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      charlie: ethSigners[3],
    };

    // Skip tests on non-mock networks
    if (!fhevm.isMock) {
      this.skip();
    }
  });

  beforeEach(async function () {
    // Check if we're in FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This test suite can only run on FHEVM mock environment`);
      this.skip();
    }

    // Deploy mock contracts
    mockPriceFeed = await MockPriceFeed.deploy();
    mockRouter = await MockUniswapRouter.deploy();
    mockUSDC = await MockUSDC.deploy();
    mockWETH = await MockWETH.deploy();

    // Deploy IntentCollector
    const intentCollectorFactory = (await ethers.getContractFactory("IntentCollector")) as IntentCollector__factory;
    intentCollector = (await intentCollectorFactory.deploy(signers.deployer.address)) as IntentCollector;

    // Skip ConfidentialToken deployment (deprecated)
    
    // Deploy FundPool
    const fundPoolFactory = (await ethers.getContractFactory("TestFundPool")) as TestFundPool__factory;
    fundPool = (await fundPoolFactory.deploy(await mockUSDC.getAddress(), signers.deployer.address)) as TestFundPool;

    // Deploy BatchProcessor
    const batchProcessorFactory = (await ethers.getContractFactory("TestBatchProcessor")) as TestBatchProcessor__factory;
    batchProcessor = (await batchProcessorFactory.deploy(
      await intentCollector.getAddress(),
      await mockPriceFeed.getAddress(),
      await mockRouter.getAddress(),
      await mockUSDC.getAddress(),
      await mockWETH.getAddress(),
      signers.deployer.address,
    )) as TestBatchProcessor;

    batchProcessorAddress = await batchProcessor.getAddress();

    // Configure contracts
    await intentCollector.setBatchProcessor(batchProcessorAddress);
    await intentCollector.setFundPool(await fundPool.getAddress());
    await fundPool.setIntentCollector(await intentCollector.getAddress());
    await fundPool.setBatchProcessor(batchProcessorAddress);
    // Skip ConfidentialToken configuration (deprecated)

    // Set up test data and balances
    await setupTestData();
  });

  async function setupTestData() {
    // Mint USDC to users
    const amount = ethers.parseUnits("10000", 6); // 10,000 USDC
    await mockUSDC.mint(signers.alice.address, amount);
    await mockUSDC.mint(signers.bob.address, amount);
    await mockUSDC.mint(signers.charlie.address, amount);

    // Approve FundPool for deposits
    await mockUSDC.connect(signers.alice).approve(await fundPool.getAddress(), amount);
    await mockUSDC.connect(signers.bob).approve(await fundPool.getAddress(), amount);
    await mockUSDC.connect(signers.charlie).approve(await fundPool.getAddress(), amount);

    // Initialize user balances in FundPool (simplified for testing)
    await fundPool.testInitializeBalance(signers.alice.address, amount);
    await fundPool.testInitializeBalance(signers.bob.address, amount);
    await fundPool.testInitializeBalance(signers.charlie.address, amount);

    // Mint some USDC to FundPool for withdrawals
    await mockUSDC.mint(await fundPool.getAddress(), ethers.parseUnits("30000", 6));

    // Update user states to ACTIVE
    await intentCollector.connect(signers.deployer).setBatchProcessor(signers.deployer.address);
    await intentCollector.connect(signers.deployer).updateUserState(signers.alice.address, 1); // ACTIVE
    await intentCollector.connect(signers.deployer).updateUserState(signers.bob.address, 1); // ACTIVE
    await intentCollector.connect(signers.deployer).updateUserState(signers.charlie.address, 1); // ACTIVE

    // Reset batch processor for IntentCollector
    await intentCollector.connect(signers.deployer).setBatchProcessor(batchProcessorAddress);
  }

  describe("Deployment", function () {
    it("should initialize with correct parameters", async function () {
      expect(await batchProcessor.intentCollector()).to.equal(await intentCollector.getAddress());
      expect(await batchProcessor.priceFeed()).to.equal(await mockPriceFeed.getAddress());
      expect(await batchProcessor.uniswapRouter()).to.equal(await mockRouter.getAddress());
      expect(await batchProcessor.usdcToken()).to.equal(await mockUSDC.getAddress());
      expect(await batchProcessor.wethAddress()).to.equal(await mockWETH.getAddress());
    });
  });

  describe("Chainlink Automation Integration", function () {
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
        maxPriceProof: encryptedInput.inputProof,
      };
    }

    async function submitTestIntents(count: number = 5) {
      for (let i = 0; i < count; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        const intentCollectorAddress = await intentCollector.getAddress();

        const encryptedInput = await fhevm
          .createEncryptedInput(intentCollectorAddress, signer.address)
          .add64(BigInt(1000 + i) * 1000000n) // budget
          .add32(10) // tradesCount
          .add64(100n * 1000000n) // amountPerTrade
          .add32(86400) // frequency
          .add64(1500n * 100n) // minPrice: $1500 in cents
          .add64(2000n * 100n) // maxPrice: $2000 in cents
          .encrypt();

        const params = createSubmitIntentParams(encryptedInput);
        await intentCollector.connect(signer).submitIntent(params);
      }
    }

    it("should check upkeep correctly when batch is ready", async function () {
      // Submit intents to make batch ready (need 5 intents for default minBatchSize)
      await submitTestIntents(5);

      // Check upkeep
      const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep("0x");

      expect(upkeepNeeded).to.be.true;
      expect(performData).to.not.equal("0x");

      // Decode perform data to verify it contains batch info (new format: batchId only)
      const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], performData);
      expect(decodedData[0]).to.equal(1); // batchId
    });

    it("should not need upkeep when no batch is ready", async function () {
      // Submit only 2 intents (less than MIN_BATCH_SIZE = 5)
      await submitTestIntents(2);

      const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep("0x");

      expect(upkeepNeeded).to.be.false;
      expect(performData).to.equal("0x");
    });

    it("should not need upkeep when automation is disabled", async function () {
      // Submit intents to make batch ready (need MAX_BATCH_SIZE = 10)
      await submitTestIntents(10);

      // Disable automation
      await batchProcessor.connect(signers.deployer).setAutomationEnabled(false);

      const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep("0x");

      expect(upkeepNeeded).to.be.false;
    });

    // Pause functionality removed from contract, test skipped
    it.skip("should not need upkeep when contract is paused", async function () {
      // This test is skipped as pause functionality was removed
    });

    it("should not need upkeep with stale price data", async function () {
      // Submit intents to make batch ready (need MAX_BATCH_SIZE = 10)
      await submitTestIntents(10);

      // Set stale price data (older than PRICE_STALENESS_THRESHOLD)
      await mockPriceFeed.setLatestRoundData(
        1,
        180000000000,
        Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        Math.floor(Date.now() / 1000) - 7200,
        1,
      );

      const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep("0x");

      expect(upkeepNeeded).to.be.false;
    });
  });

  describe("Manual Batch Processing", function () {
    beforeEach(async function () {
      // Set up mock price feed
      await mockPriceFeed.setLatestRoundData(
        1,
        180000000000, // $1800
        Math.floor(Date.now() / 1000) - 100,
        Math.floor(Date.now() / 1000),
        1,
      );

      // Set up mock router to return some ETH for swaps
      await mockRouter.setSwapResult(ethers.parseEther("1")); // 1 ETH return

      // Give mock router WETH for swap outputs
      await mockWETH.mint(await mockRouter.getAddress(), ethers.parseEther("100"));

      // Give batch processor some USDC for testing
      await mockUSDC.mint(batchProcessorAddress, ethers.parseUnits("10000", 6)); // 10,000 USDC

      // Also approve BatchProcessor to transfer from FundPool for batch processing
      await mockUSDC.connect(signers.deployer).approve(batchProcessorAddress, ethers.MaxUint256);
    });

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
        maxPriceProof: encryptedInput.inputProof,
      };
    }

    async function submitAndProcessBatch() {
      // Submit 10 intents to trigger batch processing (MAX_BATCH_SIZE)
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        const intentCollectorAddress = await intentCollector.getAddress();

        const encryptedInput = await fhevm
          .createEncryptedInput(intentCollectorAddress, signer.address)
          .add64(BigInt(1000 + i) * 1000000n) // budget
          .add32(10) // tradesCount
          .add64(100n * 1000000n) // amountPerTrade
          .add32(86400) // frequency
          .add64(1500n * 100n) // minPrice: $1500 in cents
          .add64(2000n * 100n) // maxPrice: $2000 in cents
          .encrypt();

        const params = createSubmitIntentParams(encryptedInput);
        await intentCollector.connect(signer).submitIntent(params);
      }

      // Manually trigger batch processing
      return await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);
    }

    it("should allow owner to manually trigger batch processing", async function () {
      const tx = await submitAndProcessBatch();

      // Check that batch was processed
      expect(await batchProcessor.lastProcessedBatch()).to.equal(1);

      // Check batch result
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.batchId).to.equal(1);
      expect(batchResult.success).to.be.true;
      expect(batchResult.participantCount).to.equal(10); // MAX_BATCH_SIZE
    });

    it("should emit AutomationTriggered event on manual trigger", async function () {
      // Submit intents first
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        const intentCollectorAddress = await intentCollector.getAddress();

        const encryptedInput = await fhevm
          .createEncryptedInput(intentCollectorAddress, signer.address)
          .add64(BigInt(1000 + i) * 1000000n)
          .add32(10)
          .add64(100n * 1000000n)
          .add32(86400)
          .add64(1500n * 100n)
          .add64(2000n * 100n)
          .encrypt();

        const params = createSubmitIntentParams(encryptedInput);
        await intentCollector.connect(signer).submitIntent(params);
      }

      await expect(batchProcessor.connect(signers.deployer).testManualTriggerBatch(1))
        .to.emit(batchProcessor, "AutomationTriggered")
        .withArgs(1, "Manual Trigger");
    });

    it("should emit BatchProcessed event after successful processing", async function () {
      // Submit intents
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        const intentCollectorAddress = await intentCollector.getAddress();

        const encryptedInput = await fhevm
          .createEncryptedInput(intentCollectorAddress, signer.address)
          .add64(BigInt(1000 + i) * 1000000n)
          .add32(10)
          .add64(100n * 1000000n)
          .add32(86400)
          .add64(1500n * 100n)
          .add64(2000n * 100n)
          .encrypt();

        const params = createSubmitIntentParams(encryptedInput);
        await intentCollector.connect(signer).submitIntent(params);
      }

      await expect(batchProcessor.connect(signers.deployer).testManualTriggerBatch(1)).to.emit(
        batchProcessor,
        "BatchProcessed",
      );
    });

    it("should revert manual trigger from non-owner", async function () {
      await expect(batchProcessor.connect(signers.alice).testManualTriggerBatch(1)).to.be.revertedWithCustomError(
        batchProcessor,
        "OwnableUnauthorizedAccount",
      );
    });

    // Pause functionality removed from contract, test skipped
    it.skip("should revert manual trigger when paused", async function () {
      // This test is skipped as pause functionality was removed
    });

    it("should handle batch with no valid intents", async function () {
      // Set price outside all intent ranges
      await mockPriceFeed.setLatestRoundData(
        1,
        100000000000, // $1000 (below all minPrice of $1500)
        Math.floor(Date.now() / 1000) - 100,
        Math.floor(Date.now() / 1000),
        1,
      );

      // Submit intents
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        const intentCollectorAddress = await intentCollector.getAddress();

        const encryptedInput = await fhevm
          .createEncryptedInput(intentCollectorAddress, signer.address)
          .add64(BigInt(1000 + i) * 1000000n)
          .add32(10)
          .add64(100n * 1000000n)
          .add32(86400)
          .add64(1500n * 100n) // minPrice: $1500
          .add64(2000n * 100n) // maxPrice: $2000
          .encrypt();

        const params = createSubmitIntentParams(encryptedInput);
        await intentCollector.connect(signer).submitIntent(params);
      }

      // Process batch
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);

      // Check batch result - should succeed but with 0 swapped amount
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.success).to.be.true;
      expect(batchResult.totalAmountIn).to.equal(0);
    });
  });

  describe("Price Range Filtering", function () {
    beforeEach(async function () {
      // Set up mock router to return some ETH for swaps
      await mockRouter.setSwapResult(ethers.parseEther("1")); // 1 ETH return

      // Give mock router WETH for swap outputs
      await mockWETH.mint(await mockRouter.getAddress(), ethers.parseEther("100"));

      // Give batch processor some USDC for testing
      await mockUSDC.mint(batchProcessorAddress, ethers.parseUnits("10000", 6)); // 10,000 USDC

      // Also approve BatchProcessor to transfer from FundPool for batch processing
      await mockUSDC.connect(signers.deployer).approve(batchProcessorAddress, ethers.MaxUint256);
    });

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
        maxPriceProof: encryptedInput.inputProof,
      };
    }

    it("should filter intents based on price range", async function () {
      // Set price at $1800
      await mockPriceFeed.setLatestRoundData(
        1,
        180000000000, // $1800
        Math.floor(Date.now() / 1000) - 100,
        Math.floor(Date.now() / 1000),
        1,
      );

      // Submit intents with different price ranges
      const intentCollectorAddress = await intentCollector.getAddress();

      // Intent 1: Price in range ($1500-$2000)
      const encryptedInput1 = await fhevm
        .createEncryptedInput(intentCollectorAddress, signers.alice.address)
        .add64(1000n * 1000000n)
        .add32(10)
        .add64(100n * 1000000n)
        .add32(86400)
        .add64(1500n * 100n) // minPrice: $1500
        .add64(2000n * 100n) // maxPrice: $2000
        .encrypt();

      const params1 = createSubmitIntentParams(encryptedInput1);
      await intentCollector.connect(signers.alice).submitIntent(params1);

      // Intent 2: Price too high ($1000-$1700)
      const encryptedInput2 = await fhevm
        .createEncryptedInput(intentCollectorAddress, signers.bob.address)
        .add64(1000n * 1000000n)
        .add32(10)
        .add64(100n * 1000000n)
        .add32(86400)
        .add64(1000n * 100n) // minPrice: $1000
        .add64(1700n * 100n) // maxPrice: $1700 (below current price)
        .encrypt();

      const params2 = createSubmitIntentParams(encryptedInput2);
      await intentCollector.connect(signers.bob).submitIntent(params2);

      // Add more intents to reach MIN_BATCH_SIZE
      for (let i = 2; i < 5; i++) {
        const encryptedInput = await fhevm
          .createEncryptedInput(intentCollectorAddress, signers.alice.address)
          .add64(500n * 1000000n)
          .add32(5)
          .add64(100n * 1000000n)
          .add32(86400)
          .add64(1700n * 100n) // minPrice: $1700
          .add64(1900n * 100n) // maxPrice: $1900
          .encrypt();

        const params = createSubmitIntentParams(encryptedInput);
        await intentCollector.connect(signers.alice).submitIntent(params);
      }

      // Process batch
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);

      // Check batch result
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.success).to.be.true;
      // Note: Can't easily verify exact filtered count due to FHE
    });

    it("should handle all intents filtered out", async function () {
      // Set price very high, outside all ranges
      await mockPriceFeed.setLatestRoundData(
        1,
        300000000000, // $3000
        Math.floor(Date.now() / 1000) - 100,
        Math.floor(Date.now() / 1000),
        1,
      );

      // Submit intents with low price ranges
      for (let i = 0; i < 5; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        const intentCollectorAddress = await intentCollector.getAddress();

        const encryptedInput = await fhevm
          .createEncryptedInput(intentCollectorAddress, signer.address)
          .add64(1000n * 1000000n)
          .add32(10)
          .add64(100n * 1000000n)
          .add32(86400)
          .add64(1000n * 100n) // minPrice: $1000
          .add64(2000n * 100n) // maxPrice: $2000 (below current price of $3000)
          .encrypt();

        const params = createSubmitIntentParams(encryptedInput);
        await intentCollector.connect(signer).submitIntent(params);
      }

      // Process batch
      await batchProcessor.connect(signers.deployer).testManualTriggerBatch(1);

      // Check batch result
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.success).to.be.true;
      expect(batchResult.totalAmountIn).to.equal(0); // No swaps should occur
    });
  });

  describe("Access Control", function () {
    // Pause functionality removed from contract, test skipped
    it.skip("should allow owner to pause and unpause", async function () {
      // This test is skipped as pause functionality was removed
    });

    // Pause functionality removed from contract, test skipped
    it.skip("should revert pause from non-owner", async function () {
      // This test is skipped as pause functionality was removed
    });

    it("should allow owner to set automation enabled", async function () {
      await batchProcessor.connect(signers.deployer).setAutomationEnabled(false);
      expect(await batchProcessor.automationEnabled()).to.be.false;

      await batchProcessor.connect(signers.deployer).setAutomationEnabled(true);
      expect(await batchProcessor.automationEnabled()).to.be.true;
    });

    it("should revert setAutomationEnabled from non-owner", async function () {
      await expect(batchProcessor.connect(signers.alice).setAutomationEnabled(false)).to.be.revertedWithCustomError(
        batchProcessor,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("Emergency Functions", function () {
    it("should allow owner to recover stuck tokens", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(batchProcessorAddress, amount);

      const ownerBalanceBefore = await mockUSDC.balanceOf(signers.deployer.address);

      await batchProcessor.connect(signers.deployer).recoverToken(await mockUSDC.getAddress(), amount);

      const ownerBalanceAfter = await mockUSDC.balanceOf(signers.deployer.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(amount);
    });

    it("should revert recover from non-owner", async function () {
      await expect(
        batchProcessor.connect(signers.alice).recoverToken(await mockUSDC.getAddress(), 100),
      ).to.be.revertedWithCustomError(batchProcessor, "OwnableUnauthorizedAccount");
    });
  });
});
