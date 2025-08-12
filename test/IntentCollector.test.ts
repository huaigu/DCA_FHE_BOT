import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { IntentCollector, IntentCollector__factory } from "../types";
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
  
  const factory = (await ethers.getContractFactory("IntentCollector")) as IntentCollector__factory;
  const intentCollector = (await factory.deploy(deployer.address)) as IntentCollector;
  const contractAddress = await intentCollector.getAddress();

  return { intentCollector, contractAddress, deployer };
}

describe("IntentCollector", function () {
  let signers: Signers;
  let intentCollector: IntentCollector;
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

    ({ intentCollector, contractAddress } = await deployFixture());
    
    // Set batch processor
    await intentCollector.connect(signers.deployer).setBatchProcessor(signers.batchProcessor.address);
  });

  describe("Deployment", function () {
    it("should initialize with correct parameters", async function () {
      expect(await intentCollector.intentCounter()).to.equal(0);
      expect(await intentCollector.batchCounter()).to.equal(1);
      expect(await intentCollector.batchProcessor()).to.equal(signers.batchProcessor.address);
    });

    it("should set correct batch parameters", async function () {
      // Check constants are accessible through view functions
      const pendingCount = await intentCollector.getPendingIntentsCount();
      expect(pendingCount).to.equal(0);
    });
  });

  describe("Intent Submission", function () {
    it("should submit encrypted intent successfully", async function () {
      // Create encrypted inputs
      const budget = 1000n * 1000000n; // 1000 USDC (6 decimals)
      const tradesCount = 10;
      const amountPerTrade = 100n * 1000000n; // 100 USDC per trade
      const frequency = 86400; // 24 hours
      const minPrice = 1500n * 100n; // $1500 in cents
      const maxPrice = 2000n * 100n; // $2000 in cents

      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(budget)
        .add32(tradesCount)
        .add64(amountPerTrade)
        .add32(frequency)
        .add64(minPrice)
        .add64(maxPrice)
        .encrypt();

      const tx = await intentCollector
        .connect(signers.alice)
        .submitIntent(
          encryptedInput.handles[0], encryptedInput.inputProof,
          encryptedInput.handles[1], encryptedInput.inputProof,
          encryptedInput.handles[2], encryptedInput.inputProof,
          encryptedInput.handles[3], encryptedInput.inputProof,
          encryptedInput.handles[4], encryptedInput.inputProof,
          encryptedInput.handles[5], encryptedInput.inputProof
        );

      await tx.wait();

      // Check intent was created
      expect(await intentCollector.intentCounter()).to.equal(1);
      expect(await intentCollector.getPendingIntentsCount()).to.equal(1);

      // Check intent details
      const intent = await intentCollector.getIntent(1);
      expect(intent.user).to.equal(signers.alice.address);
      expect(intent.batchId).to.equal(1);
      expect(intent.isActive).to.be.true;
      expect(intent.isProcessed).to.be.false;
    });

    it("should track user intents correctly", async function () {
      // Submit two intents from Alice
      const encryptedInput1 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(1000n * 1000000n)
        .add32(10)
        .add64(100n * 1000000n)
        .add32(86400)
        .add64(1500n * 100n)
        .add64(2000n * 100n)
        .encrypt();

      const encryptedInput2 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(2000n * 1000000n)
        .add32(20)
        .add64(100n * 1000000n)
        .add32(86400)
        .add64(1600n * 100n)
        .add64(2100n * 100n)
        .encrypt();

      await intentCollector
        .connect(signers.alice)
        .submitIntent(
          encryptedInput1.handles[0], encryptedInput1.inputProof,
          encryptedInput1.handles[1], encryptedInput1.inputProof,
          encryptedInput1.handles[2], encryptedInput1.inputProof,
          encryptedInput1.handles[3], encryptedInput1.inputProof,
          encryptedInput1.handles[4], encryptedInput1.inputProof,
          encryptedInput1.handles[5], encryptedInput1.inputProof
        );

      await intentCollector
        .connect(signers.alice)
        .submitIntent(
          encryptedInput2.handles[0], encryptedInput2.inputProof,
          encryptedInput2.handles[1], encryptedInput2.inputProof,
          encryptedInput2.handles[2], encryptedInput2.inputProof,
          encryptedInput2.handles[3], encryptedInput2.inputProof,
          encryptedInput2.handles[4], encryptedInput2.inputProof,
          encryptedInput2.handles[5], encryptedInput2.inputProof
        );

      // Check user intents
      const userIntents = await intentCollector.getUserIntents(signers.alice.address);
      expect(userIntents.length).to.equal(2);
      expect(userIntents[0]).to.equal(1);
      expect(userIntents[1]).to.equal(2);
    });

    it("should emit IntentSubmitted event", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(1000n * 1000000n)
        .add32(10)
        .add64(100n * 1000000n)
        .add32(86400)
        .add64(1500n * 100n)
        .add64(2000n * 100n)
        .encrypt();

      await expect(
        intentCollector
          .connect(signers.alice)
          .submitIntent(
            encryptedInput.handles[0], encryptedInput.inputProof,
            encryptedInput.handles[1], encryptedInput.inputProof,
            encryptedInput.handles[2], encryptedInput.inputProof,
            encryptedInput.handles[3], encryptedInput.inputProof,
            encryptedInput.handles[4], encryptedInput.inputProof,
            encryptedInput.handles[5], encryptedInput.inputProof
          )
      ).to.emit(intentCollector, "IntentSubmitted")
       .withArgs(1, signers.alice.address, 1, anyValue());
    });
  });

  describe("Batch Management", function () {
    async function submitMultipleIntents(count: number) {
      for (let i = 0; i < count; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        const encryptedInput = await fhevm
          .createEncryptedInput(contractAddress, signer.address)
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
    }

    it("should track batch readiness correctly", async function () {
      // Initially no batch ready
      const [isReady1, batchId1, intentIds1] = await intentCollector.checkBatchReady();
      expect(isReady1).to.be.false;
      expect(batchId1).to.equal(1);
      expect(intentIds1.length).to.equal(0);

      // Submit 3 intents (less than MIN_BATCH_SIZE)
      await submitMultipleIntents(3);

      // Still not ready (need MIN_BATCH_SIZE = 5)
      const [isReady2, , intentIds2] = await intentCollector.checkBatchReady();
      expect(isReady2).to.be.false;
      expect(intentIds2.length).to.equal(3);

      // Submit 2 more to reach MIN_BATCH_SIZE
      await submitMultipleIntents(2);

      // Now should be ready
      const [isReady3, , intentIds3] = await intentCollector.checkBatchReady();
      expect(isReady3).to.be.true;
      expect(intentIds3.length).to.equal(5);
    });

    it("should emit BatchReady event when batch is ready", async function () {
      // Submit MAX_BATCH_SIZE intents to trigger immediate batch ready
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const signer = i % 2 === 0 ? signers.alice : signers.bob;
        const encryptedInput = await fhevm
          .createEncryptedInput(contractAddress, signer.address)
          .add64(BigInt(1000 + i) * 1000000n)
          .add32(10)
          .add64(100n * 1000000n)
          .add32(86400)
          .add64(1500n * 100n)
          .add64(2000n * 100n)
          .encrypt();

        if (i === 9) {
          // The last intent should trigger BatchReady event
          await expect(
            intentCollector
              .connect(signer)
              .submitIntent(
                encryptedInput.handles[0], encryptedInput.inputProof,
                encryptedInput.handles[1], encryptedInput.inputProof,
                encryptedInput.handles[2], encryptedInput.inputProof,
                encryptedInput.handles[3], encryptedInput.inputProof,
                encryptedInput.handles[4], encryptedInput.inputProof,
                encryptedInput.handles[5], encryptedInput.inputProof
              )
          ).to.emit(intentCollector, "BatchReady")
           .withArgs(1, 10, anyValue());
        } else {
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
    });

    it("should allow batch processor to mark intents as processed", async function () {
      // Submit some intents
      await submitMultipleIntents(5);

      // Get intent IDs
      const intentIds = [1, 2, 3, 4, 5];

      // Mark as processed (should only work from batch processor)
      await intentCollector
        .connect(signers.batchProcessor)
        .markIntentsProcessed(intentIds, true);

      // Check intents are marked as processed
      for (let i = 1; i <= 5; i++) {
        const intent = await intentCollector.getIntent(i);
        expect(intent.isProcessed).to.be.true;
        expect(intent.isActive).to.be.true; // Should remain active if successful
      }
    });

    it("should start new batch correctly", async function () {
      // Submit intents to current batch
      await submitMultipleIntents(5);

      // Start new batch
      await intentCollector.connect(signers.batchProcessor).startNewBatch();

      // Check new batch started
      expect(await intentCollector.batchCounter()).to.equal(2);
      expect(await intentCollector.getPendingIntentsCount()).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("should only allow owner to set batch processor", async function () {
      await expect(
        intentCollector.connect(signers.alice).setBatchProcessor(signers.alice.address)
      ).to.be.revertedWithCustomError(intentCollector, "OwnableUnauthorizedAccount");
    });

    it("should only allow batch processor to mark intents as processed", async function () {
      await expect(
        intentCollector.connect(signers.alice).markIntentsProcessed([1], true)
      ).to.be.revertedWithCustomError(intentCollector, "UnauthorizedCaller");
    });

    it("should only allow batch processor to start new batch", async function () {
      await expect(
        intentCollector.connect(signers.alice).startNewBatch()
      ).to.be.revertedWithCustomError(intentCollector, "UnauthorizedCaller");
    });
  });

  describe("Error Handling", function () {
    it("should revert when getting non-existent intent", async function () {
      await expect(
        intentCollector.getIntent(999)
      ).to.be.revertedWithCustomError(intentCollector, "IntentNotFound");
    });

    it("should revert when marking non-existent intent as processed", async function () {
      await expect(
        intentCollector.connect(signers.batchProcessor).markIntentsProcessed([999], true)
      ).to.be.revertedWithCustomError(intentCollector, "IntentNotFound");
    });

    it("should revert when setting invalid batch processor", async function () {
      await expect(
        intentCollector.connect(signers.deployer).setBatchProcessor(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(intentCollector, "InvalidBatchProcessor");
    });
  });
});

// Helper function for any value matcher
function anyValue() {
  return expect.anything();
}