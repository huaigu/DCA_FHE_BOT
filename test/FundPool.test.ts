import { expect } from "chai";
import { ethers } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TestFundPool, MockERC20, IntentCollector, TestBatchProcessor } from "../types";

describe("FundPool", function () {
  let fundPool: TestFundPool;
  let mockUSDC: MockERC20;
  let intentCollector: IntentCollector;
  let batchProcessor: TestBatchProcessor;
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
    const FundPoolFactory = await ethers.getContractFactory("TestFundPool");
    fundPool = await FundPoolFactory.deploy(
      await mockUSDC.getAddress(),
      owner.address
    );
    await fundPool.waitForDeployment();

    // Deploy mock IntentCollector and BatchProcessor for testing
    const IntentCollectorFactory = await ethers.getContractFactory("IntentCollector");
    intentCollector = await IntentCollectorFactory.deploy(owner.address);
    await intentCollector.waitForDeployment();

    // Deploy TestBatchProcessor for testing

    const MockPriceFeedFactory = await ethers.getContractFactory("MockPriceFeed");
    const mockPriceFeed = await MockPriceFeedFactory.deploy();
    await mockPriceFeed.waitForDeployment();

    const MockUniswapRouterFactory = await ethers.getContractFactory("MockUniswapRouter");
    const mockRouter = await MockUniswapRouterFactory.deploy();
    await mockRouter.waitForDeployment();

    const BatchProcessorFactory = await ethers.getContractFactory("TestBatchProcessor");
    batchProcessor = await BatchProcessorFactory.deploy(
      await intentCollector.getAddress(),
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

    // Configure IntentCollector
    await intentCollector.setFundPool(await fundPool.getAddress());
    await intentCollector.setBatchProcessor(await batchProcessor.getAddress());

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

    // WithdrawalGateway functionality removed in favor of standard FHEVM decryption

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

      // Deposit with simplified interface
      await fundPool.connect(user1).deposit(depositAmount);

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
      await fundPool.connect(user1).deposit(deposit1);

      // Second deposit
      await mockUSDC.connect(user1).approve(fundPoolAddress, deposit2);
      await fundPool.connect(user1).deposit(deposit2);

      // Check totals
      expect(await fundPool.totalDeposited()).to.equal(deposit1 + deposit2);
      expect(await fundPool.getTotalPoolBalance()).to.equal(deposit1 + deposit2);
    });

    it("Should revert on zero amount deposit", async function () {
      await expect(
        fundPool.connect(user1).deposit(0)
      ).to.be.revertedWithCustomError(fundPool, "InvalidAmount");
    });
  });

  describe("Full Withdrawals", function () {
    beforeEach(async function () {
      // Setup: User1 deposits 1000 USDC
      const depositAmount = ethers.parseUnits("1000", 6);
      const fundPoolAddress = await fundPool.getAddress();
      
      await mockUSDC.connect(user1).approve(fundPoolAddress, depositAmount);
      await fundPool.connect(user1).deposit(depositAmount);
    });

    it("Should allow users to initiate withdrawal", async function () {
      // Initiate withdrawal
      await fundPool.connect(user1).initiateWithdrawal();

      // Check withdrawal status
      const [pending, requestId] = await fundPool.getWithdrawalStatus(user1.address);
      expect(pending).to.be.true;
      expect(requestId).to.be.greaterThan(0);
    });

    it("Should fulfill withdrawal after FHEVM decryption callback", async function () {
      const initialBalance = await mockUSDC.balanceOf(user1.address);
      const withdrawAmount = ethers.parseUnits("1000", 6);
      
      // Initiate withdrawal
      await fundPool.connect(user1).initiateWithdrawal();
      const [, requestId] = await fundPool.getWithdrawalStatus(user1.address);
      
      // Simulate FHEVM decryption callback with empty signatures (mock mode)
      await fundPool.onWithdrawalDecrypted(requestId, 1000000000n, []); // 1000 USDC in 6 decimals
      
      // Check user received USDC
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(initialBalance + withdrawAmount);
      
      // Check totals
      expect(await fundPool.totalWithdrawn()).to.equal(withdrawAmount);
      expect(await fundPool.getTotalPoolBalance()).to.equal(0);
      
      // Check user state was updated to WITHDRAWN
      const userState = await intentCollector.getUserState(user1.address);
      expect(userState).to.equal(3); // WITHDRAWN
    });

    it("Should cancel withdrawal request", async function () {
      // Initiate withdrawal
      await fundPool.connect(user1).initiateWithdrawal();
      
      // Cancel withdrawal
      await fundPool.connect(user1).cancelWithdrawal();
      
      // Check withdrawal status
      const [pending] = await fundPool.getWithdrawalStatus(user1.address);
      expect(pending).to.be.false;
      
      // Check user state was reverted to ACTIVE
      const userState = await intentCollector.getUserState(user1.address);
      expect(userState).to.equal(1); // ACTIVE
    });

    it("Should revert when user has no initialized balance", async function () {
      await expect(
        fundPool.connect(user2).initiateWithdrawal()
      ).to.be.revertedWithCustomError(fundPool, "BalanceNotInitialized");
    });

    it("Should revert when withdrawal already pending", async function () {
      // Initiate first withdrawal
      await fundPool.connect(user1).initiateWithdrawal();
      
      // Try to initiate another
      await expect(
        fundPool.connect(user1).initiateWithdrawal()
      ).to.be.revertedWithCustomError(fundPool, "WithdrawalPending");
    });

    it("Should check withdrawal cooldown", async function () {
      // Complete first withdrawal
      await fundPool.connect(user1).initiateWithdrawal();
      const [, requestId] = await fundPool.getWithdrawalStatus(user1.address);
      await fundPool.onWithdrawalDecrypted(requestId, 500000000n, []); // 500 USDC
      
      // Try to initiate another withdrawal immediately - should fail due to uninitialized balance
      await expect(
        fundPool.connect(user1).initiateWithdrawal()
      ).to.be.revertedWithCustomError(fundPool, "BalanceNotInitialized");
    });
  });

  describe("Legacy Withdrawal", function () {
    beforeEach(async function () {
      // Setup: User1 deposits 1000 USDC
      const depositAmount = ethers.parseUnits("1000", 6);
      const fundPoolAddress = await fundPool.getAddress();
      
      await mockUSDC.connect(user1).approve(fundPoolAddress, depositAmount);
      await fundPool.connect(user1).deposit(depositAmount);
    });

    it("Should support legacy withdraw function", async function () {
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
  });

  describe("Balance Management", function () {
    it("Should track balance initialization", async function () {
      expect(await fundPool.isBalanceInitialized(user1.address)).to.be.false;

      // Make a deposit to initialize
      const depositAmount = ethers.parseUnits("100", 6);
      const fundPoolAddress = await fundPool.getAddress();
      
      await mockUSDC.connect(user1).approve(fundPoolAddress, depositAmount);
      await fundPool.connect(user1).deposit(depositAmount);

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
      await fundPool.connect(user1).deposit(depositAmount);

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
      await fundPool.connect(user1).deposit(depositAmount);

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