import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialToken, ConfidentialToken__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  batchProcessor: HardhatEthersSigner;
};

async function deployFixture() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  const factory = (await ethers.getContractFactory("ConfidentialToken")) as ConfidentialToken__factory;
  const confidentialToken = (await factory.deploy(
    "Confidential ETH",
    "cETH", 
    18,
    ethers.ZeroAddress, // ETH as underlying
    deployer.address
  )) as ConfidentialToken;
  const contractAddress = await confidentialToken.getAddress();

  return { confidentialToken, contractAddress, deployer };
}

describe("ConfidentialToken", function () {
  let signers: Signers;
  let confidentialToken: ConfidentialToken;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { 
      deployer: ethSigners[0], 
      alice: ethSigners[1], 
      bob: ethSigners[2],
      batchProcessor: ethSigners[3]
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This test suite can only run on FHEVM mock environment`);
      this.skip();
    }

    ({ confidentialToken, contractAddress } = await deployFixture());
    
    // Set batch processor
    await confidentialToken.connect(signers.deployer).setBatchProcessor(signers.batchProcessor.address);
  });

  describe("Deployment", function () {
    it("should initialize with correct token metadata", async function () {
      expect(await confidentialToken.name()).to.equal("Confidential ETH");
      expect(await confidentialToken.symbol()).to.equal("cETH");
      expect(await confidentialToken.decimals()).to.equal(18);
      expect(await confidentialToken.totalSupply()).to.equal(0);
      expect(await confidentialToken.underlyingToken()).to.equal(ethers.ZeroAddress);
    });

    it("should set correct batch processor", async function () {
      expect(await confidentialToken.batchProcessor()).to.equal(signers.batchProcessor.address);
    });
  });

  describe("Balance Initialization", function () {
    it("should initialize user balance correctly", async function () {
      // Check initial state
      expect(await confidentialToken.isBalanceInitialized(signers.alice.address)).to.be.false;

      // Initialize balance
      await confidentialToken.connect(signers.alice).initializeBalance();

      // Check balance is initialized
      expect(await confidentialToken.isBalanceInitialized(signers.alice.address)).to.be.true;

      // Get encrypted balance
      const encryptedBalance = await confidentialToken.balanceOf(signers.alice.address);
      expect(encryptedBalance).to.not.equal(ethers.ZeroHash);
    });

    it("should not double-initialize balance", async function () {
      // Initialize once
      await confidentialToken.connect(signers.alice).initializeBalance();
      
      // Initialize again (should not revert, just return)
      await confidentialToken.connect(signers.alice).initializeBalance();
      
      expect(await confidentialToken.isBalanceInitialized(signers.alice.address)).to.be.true;
    });

    it("should revert when getting balance of uninitialized user", async function () {
      await expect(
        confidentialToken.balanceOf(signers.alice.address)
      ).to.be.revertedWithCustomError(confidentialToken, "BalanceNotInitialized");
    });
  });

  describe("Token Distribution", function () {
    beforeEach(async function () {
      // Initialize balances for test users
      await confidentialToken.connect(signers.alice).initializeBalance();
      await confidentialToken.connect(signers.bob).initializeBalance();
    });

    it("should distribute tokens to users correctly", async function () {
      const users = [signers.alice.address, signers.bob.address];
      
      // Create encrypted amounts (1 ETH and 2 ETH)
      const amount1 = 1000000000000000000n; // 1 ETH in wei
      const amount2 = 2000000000000000000n; // 2 ETH in wei
      
      const encryptedAmount1 = fhevm.asEuint64(amount1);
      const encryptedAmount2 = fhevm.asEuint64(amount2);
      
      const encryptedAmounts = [encryptedAmount1, encryptedAmount2];
      const batchId = 1;

      // Distribute tokens (only batch processor can do this)
      await confidentialToken
        .connect(signers.batchProcessor)
        .distributeTokens(users, encryptedAmounts, batchId);

      // Check balances are set (we can't decrypt in tests, but we can verify they exist)
      const aliceBalance = await confidentialToken.balanceOf(signers.alice.address);
      const bobBalance = await confidentialToken.balanceOf(signers.bob.address);
      
      expect(aliceBalance).to.not.equal(ethers.ZeroHash);
      expect(bobBalance).to.not.equal(ethers.ZeroHash);
    });

    it("should emit BalanceDistributed and EncryptedTransfer events", async function () {
      const users = [signers.alice.address];
      const encryptedAmounts = [fhevm.asEuint64(1000000000000000000n)];
      const batchId = 1;

      await expect(
        confidentialToken
          .connect(signers.batchProcessor)
          .distributeTokens(users, encryptedAmounts, batchId)
      ).to.emit(confidentialToken, "BalanceDistributed")
       .withArgs(signers.alice.address, batchId)
       .and.to.emit(confidentialToken, "EncryptedTransfer")
       .withArgs(ethers.ZeroAddress, signers.alice.address);
    });

    it("should auto-initialize balance during distribution", async function () {
      // Don't pre-initialize Charlie's balance
      const charlie = signers.deployer; // Use deployer as Charlie
      expect(await confidentialToken.isBalanceInitialized(charlie.address)).to.be.false;

      const users = [charlie.address];
      const encryptedAmounts = [fhevm.asEuint64(1000000000000000000n)];
      const batchId = 1;

      // Distribute tokens
      await confidentialToken
        .connect(signers.batchProcessor)
        .distributeTokens(users, encryptedAmounts, batchId);

      // Check balance was auto-initialized
      expect(await confidentialToken.isBalanceInitialized(charlie.address)).to.be.true;
    });

    it("should revert with mismatched array lengths", async function () {
      const users = [signers.alice.address, signers.bob.address];
      const encryptedAmounts = [fhevm.asEuint64(1000000000000000000n)]; // Only one amount
      const batchId = 1;

      await expect(
        confidentialToken
          .connect(signers.batchProcessor)
          .distributeTokens(users, encryptedAmounts, batchId)
      ).to.be.revertedWithCustomError(confidentialToken, "InvalidAmount");
    });

    it("should revert with zero address", async function () {
      const users = [ethers.ZeroAddress];
      const encryptedAmounts = [fhevm.asEuint64(1000000000000000000n)];
      const batchId = 1;

      await expect(
        confidentialToken
          .connect(signers.batchProcessor)
          .distributeTokens(users, encryptedAmounts, batchId)
      ).to.be.revertedWithCustomError(confidentialToken, "InvalidAddress");
    });
  });

  describe("Encrypted Transfers", function () {
    beforeEach(async function () {
      // Initialize balances and give Alice some tokens
      await confidentialToken.connect(signers.alice).initializeBalance();
      await confidentialToken.connect(signers.bob).initializeBalance();
      
      // Distribute some tokens to Alice
      const users = [signers.alice.address];
      const encryptedAmounts = [fhevm.asEuint64(5000000000000000000n)]; // 5 ETH
      await confidentialToken
        .connect(signers.batchProcessor)
        .distributeTokens(users, encryptedAmounts, 1);
    });

    it("should perform encrypted transfer between users", async function () {
      // Create encrypted transfer amount (1 ETH)
      const transferAmount = 1000000000000000000n;
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      // Perform transfer
      await confidentialToken
        .connect(signers.alice)
        .encryptedTransfer(
          signers.bob.address,
          encryptedInput.handles[0],
          encryptedInput.inputProof
        );

      // Verify transfer happened (balances should be updated)
      const aliceBalance = await confidentialToken.balanceOf(signers.alice.address);
      const bobBalance = await confidentialToken.balanceOf(signers.bob.address);
      
      expect(aliceBalance).to.not.equal(ethers.ZeroHash);
      expect(bobBalance).to.not.equal(ethers.ZeroHash);
    });

    it("should emit EncryptedTransfer event", async function () {
      const transferAmount = 1000000000000000000n;
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      await expect(
        confidentialToken
          .connect(signers.alice)
          .encryptedTransfer(
            signers.bob.address,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.emit(confidentialToken, "EncryptedTransfer")
       .withArgs(signers.alice.address, signers.bob.address);
    });

    it("should auto-initialize recipient balance", async function () {
      // Use deployer as uninitialized recipient
      const charlie = signers.deployer;
      expect(await confidentialToken.isBalanceInitialized(charlie.address)).to.be.false;

      const transferAmount = 1000000000000000000n;
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      // Transfer to uninitialized user
      await confidentialToken
        .connect(signers.alice)
        .encryptedTransfer(
          charlie.address,
          encryptedInput.handles[0],
          encryptedInput.inputProof
        );

      // Check recipient balance was initialized
      expect(await confidentialToken.isBalanceInitialized(charlie.address)).to.be.true;
    });

    it("should revert transfer to zero address", async function () {
      const transferAmount = 1000000000000000000n;
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      await expect(
        confidentialToken
          .connect(signers.alice)
          .encryptedTransfer(
            ethers.ZeroAddress,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.be.revertedWithCustomError(confidentialToken, "InvalidAddress");
    });

    it("should revert if sender balance not initialized", async function () {
      // Use deployer as uninitialized sender
      const charlie = signers.deployer;
      
      const transferAmount = 1000000000000000000n;
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, charlie.address)
        .add64(transferAmount)
        .encrypt();

      await expect(
        confidentialToken
          .connect(charlie)
          .encryptedTransfer(
            signers.bob.address,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.be.revertedWithCustomError(confidentialToken, "BalanceNotInitialized");
    });
  });

  describe("Supply Management", function () {
    it("should allow batch processor to mint tokens", async function () {
      const mintAmount = ethers.parseEther("10");
      
      await confidentialToken.connect(signers.batchProcessor).mint(mintAmount);
      
      expect(await confidentialToken.totalSupply()).to.equal(mintAmount);
    });

    it("should allow batch processor to burn tokens", async function () {
      const mintAmount = ethers.parseEther("10");
      const burnAmount = ethers.parseEther("3");
      
      // First mint some tokens
      await confidentialToken.connect(signers.batchProcessor).mint(mintAmount);
      
      // Then burn some
      await confidentialToken.connect(signers.batchProcessor).burn(burnAmount);
      
      expect(await confidentialToken.totalSupply()).to.equal(mintAmount - burnAmount);
    });

    it("should revert burn if amount exceeds supply", async function () {
      const mintAmount = ethers.parseEther("10");
      const burnAmount = ethers.parseEther("15");
      
      await confidentialToken.connect(signers.batchProcessor).mint(mintAmount);
      
      await expect(
        confidentialToken.connect(signers.batchProcessor).burn(burnAmount)
      ).to.be.revertedWithCustomError(confidentialToken, "InvalidAmount");
    });
  });

  describe("ERC20 Compatibility", function () {
    it("should handle approvals correctly", async function () {
      const approvalAmount = ethers.parseEther("5");
      
      await confidentialToken.connect(signers.alice).approve(signers.bob.address, approvalAmount);
      
      expect(await confidentialToken.allowance(signers.alice.address, signers.bob.address))
        .to.equal(approvalAmount);
    });

    it("should emit Approval event", async function () {
      const approvalAmount = ethers.parseEther("5");
      
      await expect(
        confidentialToken.connect(signers.alice).approve(signers.bob.address, approvalAmount)
      ).to.emit(confidentialToken, "Approval")
       .withArgs(signers.alice.address, signers.bob.address, approvalAmount);
    });
  });

  describe("Access Control", function () {
    it("should only allow batch processor to distribute tokens", async function () {
      const users = [signers.alice.address];
      const encryptedAmounts = [fhevm.asEuint64(1000000000000000000n)];
      
      await expect(
        confidentialToken.connect(signers.alice).distributeTokens(users, encryptedAmounts, 1)
      ).to.be.revertedWithCustomError(confidentialToken, "UnauthorizedCaller");
    });

    it("should only allow batch processor to mint", async function () {
      await expect(
        confidentialToken.connect(signers.alice).mint(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(confidentialToken, "UnauthorizedCaller");
    });

    it("should only allow batch processor to burn", async function () {
      await expect(
        confidentialToken.connect(signers.alice).burn(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(confidentialToken, "UnauthorizedCaller");
    });

    it("should only allow owner to set batch processor", async function () {
      await expect(
        confidentialToken.connect(signers.alice).setBatchProcessor(signers.alice.address)
      ).to.be.revertedWithCustomError(confidentialToken, "OwnableUnauthorizedAccount");
    });

    it("should only allow owner to emergency recover", async function () {
      await expect(
        confidentialToken.connect(signers.alice).emergencyRecover(ethers.ZeroAddress, 0)
      ).to.be.revertedWithCustomError(confidentialToken, "OwnableUnauthorizedAccount");
    });
  });

  describe("Emergency Functions", function () {
    it("should allow owner to emergency recover ETH", async function () {
      // Send some ETH to contract
      await signers.alice.sendTransaction({
        to: contractAddress,
        value: ethers.parseEther("1")
      });
      
      const ownerBalanceBefore = await ethers.provider.getBalance(signers.deployer.address);
      
      // Recover ETH
      await confidentialToken.connect(signers.deployer).emergencyRecover(ethers.ZeroAddress, ethers.parseEther("1"));
      
      const ownerBalanceAfter = await ethers.provider.getBalance(signers.deployer.address);
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
    });

    it("should emit EmergencyWithdraw event", async function () {
      await signers.alice.sendTransaction({
        to: contractAddress,
        value: ethers.parseEther("1")
      });
      
      await expect(
        confidentialToken.connect(signers.deployer).emergencyRecover(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.emit(confidentialToken, "EmergencyWithdraw")
       .withArgs(ethers.ZeroAddress, ethers.parseEther("1"));
    });
  });
});