import { expect } from "chai";
import { ethers } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FundPool, MockERC20, IntentCollector, BatchProcessor } from "../types";

describe("FundPool", function () {
  let fundPool: FundPool;
  let mockUSDC: MockERC20;
  let intentCollector: IntentCollector;
  let batchProcessor: BatchProcessor;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let addresses: any;
  let hre: any;

  beforeEach(async function () {
    // Get hardhat runtime environment
    hre = require("hardhat");
    
    // Skip tests on non-mock networks
    if (!hre.fhevm.isMock) {
      this.skip();
    }

    [owner, user1, user2] = await ethers.getSigners();
    addresses = {
      owner: owner.address,
      user1: user1.address,
      user2: user2.address,
    };

    // Deploy MockUSDC
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
    await mockUSDC.waitForDeployment();

    // Deploy FundPool
    const FundPoolFactory = await ethers.getContractFactory("FundPool");
    fundPool = await FundPoolFactory.deploy(
      await mockUSDC.getAddress(),
      owner.address
    );
    await fundPool.waitForDeployment();

    // Deploy mock IntentCollector and BatchProcessor for testing
    const IntentCollectorFactory = await ethers.getContractFactory("IntentCollector");
    intentCollector = await IntentCollectorFactory.deploy(owner.address);
    await intentCollector.waitForDeployment();

    // Deploy a mock BatchProcessor (simplified for testing)
    const ConfidentialTokenFactory = await ethers.getContractFactory("ConfidentialToken");
    const confidentialToken = await ConfidentialTokenFactory.deploy(
      "Confidential ETH",
      "cETH",
      18,
      ethers.ZeroAddress,
      owner.address
    );
    await confidentialToken.waitForDeployment();

    const MockPriceFeedFactory = await ethers.getContractFactory("MockPriceFeed");
    const mockPriceFeed = await MockPriceFeedFactory.deploy();
    await mockPriceFeed.waitForDeployment();

    const MockUniswapRouterFactory = await ethers.getContractFactory("MockUniswapRouter");
    const mockRouter = await MockUniswapRouterFactory.deploy();
    await mockRouter.waitForDeployment();

    const BatchProcessorFactory = await ethers.getContractFactory("BatchProcessor");
    batchProcessor = await BatchProcessorFactory.deploy(
      await intentCollector.getAddress(),
      await confidentialToken.getAddress(),
      await mockPriceFeed.getAddress(),
      await mockRouter.getAddress(),
      await mockUSDC.getAddress(),
      ethers.ZeroAddress,
      owner.address
    );
    await batchProcessor.waitForDeployment();

    // Configure FundPool
    await fundPool.setBatchProcessor(await batchProcessor.getAddress());
    await fundPool.setIntentCollector(await intentCollector.getAddress());

    // Mint USDC to users
    await mockUSDC.mint(user1.address, ethers.parseUnits("10000", 6)); // 10,000 USDC
    await mockUSDC.mint(user2.address, ethers.parseUnits("5000", 6));  // 5,000 USDC
  });

  describe("Deployment", function () {
    it("Should set the correct USDC token", async function () {
      expect(await fundPool.usdcToken()).to.equal(await mockUSDC.getAddress());
    });

    it("Should set the correct owner", async function () {
      expect(await fundPool.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero total deposits", async function () {
      expect(await fundPool.totalDeposited()).to.equal(0);
      expect(await fundPool.totalWithdrawn()).to.equal(0);
    });
  });

  describe("Configuration", function () {
    it("Should allow owner to set BatchProcessor", async function () {
      const newProcessor = user1.address;
      await fundPool.setBatchProcessor(newProcessor);
      expect(await fundPool.batchProcessor()).to.equal(newProcessor);
    });

    it("Should allow owner to set IntentCollector", async function () {
      const newCollector = user2.address;
      await fundPool.setIntentCollector(newCollector);
      expect(await fundPool.intentCollector()).to.equal(newCollector);
    });

    it("Should revert when non-owner tries to set BatchProcessor", async function () {
      await expect(
        fundPool.connect(user1).setBatchProcessor(user2.address)
      ).to.be.revertedWithCustomError(fundPool, "OwnableUnauthorizedAccount");
    });
  });

  describe("Deposits", function () {
    it("Should allow users to deposit USDC", async function () {
      const depositAmount = ethers.parseUnits("1000", 6); // 1000 USDC

      // Approve USDC spending
      await mockUSDC.connect(user1).approve(await fundPool.getAddress(), depositAmount);

      // Create encrypted amount
      const fundPoolAddress = await fundPool.getAddress();
      const input = await hre.fhevm.createEncryptedInput(fundPoolAddress, user1.address);
      input.add64(BigInt(depositAmount));
      const encryptedInput = await input.encrypt();

      // Deposit - pass handle, proof, and plaintext amount
      await expect(
        fundPool.connect(user1).deposit(encryptedInput.handles[0], encryptedInput.inputProof, depositAmount)
      ).to.emit(fundPool, "Deposit")
        .withArgs(user1.address, depositAmount);

      // Check total deposited
      expect(await fundPool.totalDeposited()).to.equal(depositAmount);

      // Check pool balance
      expect(await fundPool.getTotalPoolBalance()).to.equal(depositAmount);

      // Check user balance is initialized
      expect(await fundPool.isBalanceInitialized(user1.address)).to.be.true;
    });

    it("Should update encrypted balance on multiple deposits", async function () {
      const deposit1 = ethers.parseUnits("500", 6);
      const deposit2 = ethers.parseUnits("300", 6);
      const fundPoolAddress = await fundPool.getAddress();

      // First deposit
      await mockUSDC.connect(user1).approve(fundPoolAddress, deposit1);
      const input1 = await hre.fhevm.createEncryptedInput(fundPoolAddress, user1.address);
      input1.add64(BigInt(deposit1));
      const encrypted1 = await input1.encrypt();
      
      await fundPool.connect(user1).deposit(encrypted1.handles[0], encrypted1.inputProof, deposit1);

      // Second deposit
      await mockUSDC.connect(user1).approve(fundPoolAddress, deposit2);
      const input2 = await hre.fhevm.createEncryptedInput(fundPoolAddress, user1.address);
      input2.add64(BigInt(deposit2));
      const encrypted2 = await input2.encrypt();
      
      await fundPool.connect(user1).deposit(encrypted2.handles[0], encrypted2.inputProof, deposit2);

      // Check totals
      expect(await fundPool.totalDeposited()).to.equal(deposit1 + deposit2);
      expect(await fundPool.getTotalPoolBalance()).to.equal(deposit1 + deposit2);
    });

    it("Should revert on zero amount deposit", async function () {
      const fundPoolAddress = await fundPool.getAddress();
      const input = await hre.fhevm.createEncryptedInput(fundPoolAddress, user1.address);
      input.add64(0n);
      const encryptedInput = await input.encrypt();

      await expect(
        fundPool.connect(user1).deposit(encryptedInput.handles[0], encryptedInput.inputProof, 0)
      ).to.be.revertedWithCustomError(fundPool, "InvalidAmount");
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      // Setup: User1 deposits 1000 USDC
      const depositAmount = ethers.parseUnits("1000", 6);
      const fundPoolAddress = await fundPool.getAddress();
      
      await mockUSDC.connect(user1).approve(fundPoolAddress, depositAmount);
      
      const input = await hre.fhevm.createEncryptedInput(fundPoolAddress, user1.address);
      input.add64(BigInt(depositAmount));
      const encryptedInput = await input.encrypt();
      
      await fundPool.connect(user1).deposit(encryptedInput.handles[0], encryptedInput.inputProof, depositAmount);
    });

    it("Should allow users to withdraw USDC", async function () {
      const withdrawAmount = ethers.parseUnits("400", 6);
      const initialBalance = await mockUSDC.balanceOf(user1.address);
      
      // Create a dummy proof (in production, this would be a ZK proof)
      const proof = new Uint8Array(32);

      await expect(
        fundPool.connect(user1).withdraw(withdrawAmount, proof)
      ).to.emit(fundPool, "Withdrawal")
        .withArgs(user1.address, withdrawAmount);

      // Check user received USDC
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(initialBalance + withdrawAmount);

      // Check totals
      expect(await fundPool.totalWithdrawn()).to.equal(withdrawAmount);
      expect(await fundPool.getTotalPoolBalance()).to.equal(ethers.parseUnits("600", 6));
    });

    it("Should revert when user has no initialized balance", async function () {
      const proof = new Uint8Array(32);
      
      await expect(
        fundPool.connect(user2).withdraw(ethers.parseUnits("100", 6), proof)
      ).to.be.revertedWithCustomError(fundPool, "BalanceNotInitialized");
    });

    it("Should revert on zero withdrawal", async function () {
      const proof = new Uint8Array(32);
      
      await expect(
        fundPool.connect(user1).withdraw(0, proof)
      ).to.be.revertedWithCustomError(fundPool, "InvalidAmount");
    });

    it("Should revert when pool has insufficient USDC", async function () {
      // Withdraw most of the USDC from pool first
      const largeWithdraw = ethers.parseUnits("999", 6);
      const proof = new Uint8Array(32);
      await fundPool.connect(user1).withdraw(largeWithdraw, proof);

      // Try to withdraw more than available
      await expect(
        fundPool.connect(user1).withdraw(ethers.parseUnits("100", 6), proof)
      ).to.be.revertedWithCustomError(fundPool, "InsufficientBalance");
    });
  });

  describe("Balance Management", function () {
    it("Should track balance initialization", async function () {
      expect(await fundPool.isBalanceInitialized(user1.address)).to.be.false;

      // Make a deposit to initialize
      const depositAmount = ethers.parseUnits("100", 6);
      const fundPoolAddress = await fundPool.getAddress();
      
      await mockUSDC.connect(user1).approve(fundPoolAddress, depositAmount);
      
      const input = await hre.fhevm.createEncryptedInput(fundPoolAddress, user1.address);
      input.add64(BigInt(depositAmount));
      const encryptedInput = await input.encrypt();
      
      await fundPool.connect(user1).deposit(encryptedInput.handles[0], encryptedInput.inputProof, depositAmount);

      expect(await fundPool.isBalanceInitialized(user1.address)).to.be.true;
    });

    it("Should revert when trying to get uninitialized balance", async function () {
      await expect(
        fundPool.getEncryptedBalance(user2.address)
      ).to.be.revertedWithCustomError(fundPool, "BalanceNotInitialized");
    });

    it.skip("Should allow BatchProcessor to deduct balances", async function () {
      // Setup: User1 deposits
      const depositAmount = ethers.parseUnits("1000", 6);
      const fundPoolAddress = await fundPool.getAddress();
      
      await mockUSDC.connect(user1).approve(fundPoolAddress, depositAmount);
      
      const input = await hre.fhevm.createEncryptedInput(fundPoolAddress, user1.address);
      input.add64(BigInt(depositAmount));
      const encryptedInput = await input.encrypt();
      
      await fundPool.connect(user1).deposit(encryptedInput.handles[0], encryptedInput.inputProof, depositAmount);

      // Deduct as BatchProcessor
      const deductAmount = ethers.parseUnits("200", 6);
      const deductInput = await hre.fhevm.createEncryptedInput(fundPoolAddress, await batchProcessor.getAddress());
      deductInput.add64(BigInt(deductAmount));
      const deductEncrypted = await deductInput.encrypt();
      
      await expect(
        fundPool.connect(owner).deductBalance(user1.address, deductEncrypted.handles[0])
      ).to.be.revertedWithCustomError(fundPool, "UnauthorizedCaller");

      // Set proper BatchProcessor
      await fundPool.setBatchProcessor(owner.address);
      
      await expect(
        fundPool.connect(owner).deductBalance(user1.address, deductEncrypted.handles[0])
      ).to.emit(fundPool, "BalanceDeducted")
        .withArgs(user1.address);
    });

    it("Should allow BatchProcessor to transfer USDC", async function () {
      // Setup: Deposit some USDC
      const depositAmount = ethers.parseUnits("1000", 6);
      const fundPoolAddress = await fundPool.getAddress();
      
      await mockUSDC.connect(user1).approve(fundPoolAddress, depositAmount);
      
      const input = await hre.fhevm.createEncryptedInput(fundPoolAddress, user1.address);
      input.add64(BigInt(depositAmount));
      const encryptedInput = await input.encrypt();
      
      await fundPool.connect(user1).deposit(encryptedInput.handles[0], encryptedInput.inputProof, depositAmount);

      // Try to transfer as non-BatchProcessor
      await expect(
        fundPool.connect(user1).transferToBatchProcessor(ethers.parseUnits("500", 6))
      ).to.be.revertedWithCustomError(fundPool, "UnauthorizedCaller");

      // Set owner as BatchProcessor for testing
      await fundPool.setBatchProcessor(owner.address);

      const transferAmount = ethers.parseUnits("500", 6);
      await expect(
        fundPool.connect(owner).transferToBatchProcessor(transferAmount)
      ).to.emit(fundPool, "FundsTransferredToBatchProcessor")
        .withArgs(transferAmount);

      // Check USDC was transferred
      expect(await mockUSDC.balanceOf(owner.address)).to.equal(transferAmount);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to recover stuck tokens", async function () {
      // Send some USDC directly to the contract
      const stuckAmount = ethers.parseUnits("100", 6);
      await mockUSDC.mint(await fundPool.getAddress(), stuckAmount);

      const ownerBalanceBefore = await mockUSDC.balanceOf(owner.address);
      
      await fundPool.recoverToken(await mockUSDC.getAddress(), stuckAmount);
      
      expect(await mockUSDC.balanceOf(owner.address)).to.equal(ownerBalanceBefore + stuckAmount);
    });

    it("Should revert when non-owner tries to recover tokens", async function () {
      await expect(
        fundPool.connect(user1).recoverToken(await mockUSDC.getAddress(), 100)
      ).to.be.revertedWithCustomError(fundPool, "OwnableUnauthorizedAccount");
    });
  });
});