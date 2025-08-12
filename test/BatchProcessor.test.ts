import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { 
  BatchProcessor, 
  BatchProcessor__factory,
  IntentCollector,
  IntentCollector__factory,
  ConfidentialToken,
  ConfidentialToken__factory
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
  }
};

const MockUniswapRouter = {
  async deploy() {
    const factory = await ethers.getContractFactory("MockUniswapRouter");
    return await factory.deploy();
  }
};

const MockUSDC = {
  async deploy() {
    const factory = await ethers.getContractFactory("MockERC20");
    return await factory.deploy("USD Coin", "USDC", 6);
  }
};

async function deployFixture() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  // Deploy mock contracts
  const mockPriceFeed = await MockPriceFeed.deploy();
  const mockRouter = await MockUniswapRouter.deploy();
  const mockUSDC = await MockUSDC.deploy();
  const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH mainnet address (for testing)
  
  // Deploy IntentCollector
  const intentCollectorFactory = (await ethers.getContractFactory("IntentCollector")) as IntentCollector__factory;
  const intentCollector = (await intentCollectorFactory.deploy(deployer.address)) as IntentCollector;
  
  // Deploy ConfidentialToken
  const confidentialTokenFactory = (await ethers.getContractFactory("ConfidentialToken")) as ConfidentialToken__factory;
  const confidentialToken = (await confidentialTokenFactory.deploy(
    "Confidential ETH",
    "cETH",
    18,
    ethers.ZeroAddress, // ETH as underlying
    deployer.address
  )) as ConfidentialToken;
  
  // Deploy BatchProcessor
  const batchProcessorFactory = (await ethers.getContractFactory("BatchProcessor")) as BatchProcessor__factory;
  const batchProcessor = (await batchProcessorFactory.deploy(
    await intentCollector.getAddress(),
    await confidentialToken.getAddress(),
    await mockPriceFeed.getAddress(),
    await mockRouter.getAddress(),
    await mockUSDC.getAddress(),
    wethAddress,
    deployer.address
  )) as BatchProcessor;
  
  const batchProcessorAddress = await batchProcessor.getAddress();
  
  // Set up permissions
  await intentCollector.setBatchProcessor(batchProcessorAddress);
  await confidentialToken.setBatchProcessor(batchProcessorAddress);

  return { 
    batchProcessor, 
    intentCollector, 
    confidentialToken,
    mockPriceFeed,
    mockRouter,
    mockUSDC,
    batchProcessorAddress,
    deployer 
  };
}

describe("BatchProcessor", function () {
  let signers: Signers;
  let batchProcessor: BatchProcessor;
  let intentCollector: IntentCollector;
  let confidentialToken: ConfidentialToken;
  let mockPriceFeed: any;
  let mockRouter: any;
  let mockUSDC: any;
  let batchProcessorAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { 
      deployer: ethSigners[0], 
      alice: ethSigners[1], 
      bob: ethSigners[2],
      charlie: ethSigners[3]
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This test suite can only run on FHEVM mock environment`);
      this.skip();
    }

    ({ 
      batchProcessor, 
      intentCollector, 
      confidentialToken,
      mockPriceFeed,
      mockRouter,
      mockUSDC,
      batchProcessorAddress
    } = await deployFixture());
  });

  describe("Deployment", function () {
    it("should initialize with correct parameters", async function () {
      expect(await batchProcessor.intentCollector()).to.equal(await intentCollector.getAddress());
      expect(await batchProcessor.confidentialToken()).to.equal(await confidentialToken.getAddress());
      expect(await batchProcessor.priceFeed()).to.equal(await mockPriceFeed.getAddress());
      expect(await batchProcessor.uniswapRouter()).to.equal(await mockRouter.getAddress());
      expect(await batchProcessor.usdcToken()).to.equal(await mockUSDC.getAddress());
      expect(await batchProcessor.automationEnabled()).to.be.true;
      expect(await batchProcessor.lastProcessedBatch()).to.equal(0);
    });

    it("should not be paused initially", async function () {
      expect(await batchProcessor.paused()).to.be.false;
    });
  });

  describe("Chainlink Automation Integration", function () {
    beforeEach(async function () {
      // Set up mock price feed to return valid data
      await mockPriceFeed.setLatestRoundData(
        1, // roundId
        180000000000, // price: $1800 with 8 decimals
        Math.floor(Date.now() / 1000) - 100, // startedAt
        Math.floor(Date.now() / 1000), // updatedAt
        1 // answeredInRound
      );
    });

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

        await intentCollector
          .connect(signer)
          .submitIntent(
            encryptedInput.handles[0], encryptedInput.inputProof,
            encryptedInput.handles[1], encryptedInput.inputProof,
            encryptedInput.handles[2], encryptedInput.inputProof,
            encryptedInput.handles[3], encryptedInput.inputProof,
            encryptedInput.handles[4], encryptedInput.inputProof,
            encryptedInput.handles[5], encryptedInput.inputProof
          );
      }
    }

    it("should check upkeep correctly when batch is ready", async function () {
      // Submit intents to make batch ready
      await submitTestIntents(5);

      // Check upkeep
      const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep("0x");
      
      expect(upkeepNeeded).to.be.true;
      expect(performData).to.not.equal("0x");
      
      // Decode perform data to verify it contains batch info
      const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256", "uint256[]"], 
        performData
      );
      expect(decodedData[0]).to.equal(1); // batchId
      expect(decodedData[1].length).to.equal(5); // intentIds
    });

    it("should not need upkeep when no batch is ready", async function () {
      // Submit only 2 intents (less than MIN_BATCH_SIZE = 5)
      await submitTestIntents(2);

      const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep("0x");
      
      expect(upkeepNeeded).to.be.false;
      expect(performData).to.equal("0x");
    });

    it("should not need upkeep when automation is disabled", async function () {
      // Submit intents to make batch ready
      await submitTestIntents(5);

      // Disable automation
      await batchProcessor.connect(signers.deployer).setAutomationEnabled(false);

      const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep("0x");
      
      expect(upkeepNeeded).to.be.false;
    });

    it("should not need upkeep when contract is paused", async function () {
      // Submit intents to make batch ready
      await submitTestIntents(5);

      // Pause contract
      await batchProcessor.connect(signers.deployer).pause();

      const [upkeepNeeded, performData] = await batchProcessor.checkUpkeep("0x");
      
      expect(upkeepNeeded).to.be.false;
    });

    it("should not need upkeep with stale price data", async function () {
      // Submit intents to make batch ready
      await submitTestIntents(5);

      // Set stale price data (older than PRICE_STALENESS_THRESHOLD)
      await mockPriceFeed.setLatestRoundData(
        1,
        180000000000,
        Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        Math.floor(Date.now() / 1000) - 7200,
        1
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
        1
      );

      // Set up mock router to return some ETH for swaps
      await mockRouter.setSwapResult(ethers.parseEther("1")); // 1 ETH return
      
      // Give batch processor some USDC for testing
      await mockUSDC.mint(batchProcessorAddress, ethers.parseUnits("10000", 6)); // 10,000 USDC
    });

    async function submitAndProcessBatch() {
      // Submit 5 intents to trigger batch processing
      for (let i = 0; i < 5; i++) {
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

        await intentCollector
          .connect(signer)
          .submitIntent(
            encryptedInput.handles[0], encryptedInput.inputProof,
            encryptedInput.handles[1], encryptedInput.inputProof,
            encryptedInput.handles[2], encryptedInput.inputProof,
            encryptedInput.handles[3], encryptedInput.inputProof,
            encryptedInput.handles[4], encryptedInput.inputProof,
            encryptedInput.handles[5], encryptedInput.inputProof
          );
      }

      // Manually trigger batch processing
      return await batchProcessor.connect(signers.deployer).manualTriggerBatch(1);
    }

    it("should allow owner to manually trigger batch processing", async function () {
      const tx = await submitAndProcessBatch();
      
      // Check that batch was processed
      expect(await batchProcessor.lastProcessedBatch()).to.equal(1);
      
      // Check batch result
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.batchId).to.equal(1);
      expect(batchResult.success).to.be.true;
      expect(batchResult.participantCount).to.equal(5);
    });

    it("should emit AutomationTriggered event on manual trigger", async function () {
      // Submit intents first
      for (let i = 0; i < 5; i++) {
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

        await intentCollector
          .connect(signer)
          .submitIntent(
            encryptedInput.handles[0], encryptedInput.inputProof,
            encryptedInput.handles[1], encryptedInput.inputProof,
            encryptedInput.handles[2], encryptedInput.inputProof,
            encryptedInput.handles[3], encryptedInput.inputProof,
            encryptedInput.handles[4], encryptedInput.inputProof,
            encryptedInput.handles[5], encryptedInput.inputProof
          );
      }

      await expect(
        batchProcessor.connect(signers.deployer).manualTriggerBatch(1)
      ).to.emit(batchProcessor, "AutomationTriggered")
       .withArgs(1, "Manual Trigger");
    });

    it("should emit BatchProcessed event after successful processing", async function () {
      // Submit intents
      for (let i = 0; i < 5; i++) {
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

        await intentCollector
          .connect(signer)
          .submitIntent(
            encryptedInput.handles[0], encryptedInput.inputProof,
            encryptedInput.handles[1], encryptedInput.inputProof,
            encryptedInput.handles[2], encryptedInput.inputProof,
            encryptedInput.handles[3], encryptedInput.inputProof,
            encryptedInput.handles[4], encryptedInput.inputProof,
            encryptedInput.handles[5], encryptedInput.inputProof
          );
      }

      await expect(
        batchProcessor.connect(signers.deployer).manualTriggerBatch(1)
      ).to.emit(batchProcessor, "BatchProcessed")
       .withArgs(1, anyValue(), anyValue(), anyValue(), 5, true);
    });

    it("should revert manual trigger from non-owner", async function () {
      await expect(
        batchProcessor.connect(signers.alice).manualTriggerBatch(1)
      ).to.be.revertedWithCustomError(batchProcessor, "OwnableUnauthorizedAccount");
    });

    it("should revert manual trigger when paused", async function () {
      await batchProcessor.connect(signers.deployer).pause();
      
      await expect(
        batchProcessor.connect(signers.deployer).manualTriggerBatch(1)
      ).to.be.revertedWithCustomError(batchProcessor, "EnforcedPause");
    });

    it("should handle batch with no valid intents", async function () {
      // Set price outside all intent ranges
      await mockPriceFeed.setLatestRoundData(
        1,
        100000000000, // $1000 (below all minPrice of $1500)
        Math.floor(Date.now() / 1000) - 100,
        Math.floor(Date.now() / 1000),
        1
      );

      await submitAndProcessBatch();
      
      // Batch should be processed but unsuccessful
      const batchResult = await batchProcessor.getBatchResult(1);
      expect(batchResult.success).to.be.false;
      expect(batchResult.totalAmountOut).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("should only allow owner to set automation enabled", async function () {
      await expect(
        batchProcessor.connect(signers.alice).setAutomationEnabled(false)
      ).to.be.revertedWithCustomError(batchProcessor, "OwnableUnauthorizedAccount");
    });

    it("should only allow owner to pause", async function () {
      await expect(
        batchProcessor.connect(signers.alice).pause()
      ).to.be.revertedWithCustomError(batchProcessor, "OwnableUnauthorizedAccount");
    });

    it("should only allow owner to unpause", async function () {
      await batchProcessor.connect(signers.deployer).pause();
      
      await expect(
        batchProcessor.connect(signers.alice).unpause()
      ).to.be.revertedWithCustomError(batchProcessor, "OwnableUnauthorizedAccount");
    });

    it("should only allow owner to emergency withdraw", async function () {
      await expect(
        batchProcessor.connect(signers.alice).emergencyWithdraw(ethers.ZeroAddress, 0)
      ).to.be.revertedWithCustomError(batchProcessor, "OwnableUnauthorizedAccount");
    });
  });

  describe("Emergency Functions", function () {
    it("should allow owner to emergency withdraw ETH", async function () {
      // Send ETH to contract
      await signers.alice.sendTransaction({
        to: batchProcessorAddress,
        value: ethers.parseEther("1")
      });
      
      const ownerBalanceBefore = await ethers.provider.getBalance(signers.deployer.address);
      
      await batchProcessor.connect(signers.deployer).emergencyWithdraw(ethers.ZeroAddress, ethers.parseEther("1"));
      
      const ownerBalanceAfter = await ethers.provider.getBalance(signers.deployer.address);
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
    });

    it("should emit EmergencyWithdraw event", async function () {
      await signers.alice.sendTransaction({
        to: batchProcessorAddress,
        value: ethers.parseEther("1")
      });
      
      await expect(
        batchProcessor.connect(signers.deployer).emergencyWithdraw(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.emit(batchProcessor, "EmergencyWithdraw")
       .withArgs(ethers.ZeroAddress, ethers.parseEther("1"));
    });
  });

  describe("Pause Functionality", function () {
    it("should pause and unpause correctly", async function () {
      // Initially not paused
      expect(await batchProcessor.paused()).to.be.false;
      
      // Pause
      await batchProcessor.connect(signers.deployer).pause();
      expect(await batchProcessor.paused()).to.be.true;
      
      // Unpause
      await batchProcessor.connect(signers.deployer).unpause();
      expect(await batchProcessor.paused()).to.be.false;
    });
  });
});

// Helper function for any value matcher
function anyValue() {
  return expect.anything();
}