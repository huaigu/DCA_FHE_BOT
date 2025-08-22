import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * DCA FHE Bot Tasks
 * =================
 *
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *   npx hardhat node
 *
 * 2. Deploy the DCA FHE Bot contracts
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the DCA system
 *   npx hardhat --network localhost task:address
 *   npx hardhat --network localhost task:batch-status
 *   npx hardhat --network localhost task:submit-intent --budget 1000 --trades 10 --amount 100 --frequency 86400 --min-price 1500 --max-price 2000
 *   npx hardhat --network localhost task:process-batch --batch-id 1
 *   npx hardhat --network localhost task:user-balance
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * =============================================================
 *
 * 1. Deploy the DCA FHE Bot contracts
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the DCA system
 *   npx hardhat --network sepolia task:address
 *   npx hardhat --network sepolia task:batch-status
 *   npx hardhat --network sepolia task:submit-intent --budget 1000 --trades 10 --amount 100 --frequency 86400 --min-price 1500 --max-price 2000
 *   npx hardhat --network sepolia task:process-batch --batch-id 1
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:address
 *   - npx hardhat --network sepolia task:address
 */
task("task:address", "Prints the DCA FHE Bot contract addresses").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  try {
    const fundPool = await deployments.get("FundPool");
    const intentCollector = await deployments.get("IntentCollector");
    const batchProcessor = await deployments.get("BatchProcessor");

    console.log("🎯 DCA FHE Bot Contract Addresses:");
    console.log("├── FundPool:", fundPool.address);
    console.log("├── IntentCollector:", intentCollector.address);
    console.log("└── BatchProcessor:", batchProcessor.address);

    // Also show mock contracts if on localhost/hardhat
    if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
      try {
        const mockPriceFeed = await deployments.get("MockPriceFeed");
        const mockRouter = await deployments.get("MockUniswapRouter");
        const mockUSDC = await deployments.get("MockERC20");
        
        console.log("\n🔧 Mock Contract Addresses:");
        console.log("├── MockPriceFeed:", mockPriceFeed.address);
        console.log("├── MockUniswapRouter:", mockRouter.address);
        console.log("└── MockUSDC:", mockUSDC.address);
      } catch (error) {
        console.log("\n⚠️ Mock contracts not found");
      }
    }
  } catch (error) {
    console.error("❌ Error fetching contract addresses:", error);
  }
});

/**
 * Example:
 *   - npx hardhat --network localhost task:batch-status
 *   - npx hardhat --network sepolia task:batch-status
 */
task("task:batch-status", "Shows the current batch status")
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    try {
      const intentCollectorDeployment = await deployments.get("IntentCollector");
      const batchProcessorDeployment = await deployments.get("BatchProcessor");
      
      const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorDeployment.address);
      const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorDeployment.address);

      console.log("📊 DCA Batch Status:");
      
      const batchCounter = await intentCollector.batchCounter();
      const pendingCount = await intentCollector.getPendingIntentsCount();
      const lastProcessedBatch = await batchProcessor.lastProcessedBatch();
      
      console.log("├── Current Batch ID:", batchCounter.toString());
      console.log("├── Pending Intents:", pendingCount.toString());
      console.log("└── Last Processed Batch:", lastProcessedBatch.toString());

      // Check if current batch is ready
      const [isReady, batchId, intentIds] = await intentCollector.checkBatchReady();
      if (isReady) {
        console.log("\n🟢 Batch Ready for Processing:");
        console.log("├── Batch ID:", batchId.toString());
        console.log("└── Intent Count:", intentIds.length);
      } else {
        console.log("\n🟡 No batch ready for processing");
        console.log("├── Need", (5n - pendingCount).toString(), "more intents");
        console.log("└── Current pending:", pendingCount.toString());
      }

      // Check automation status
      const automationEnabled = await batchProcessor.automationEnabled();
      const paused = await batchProcessor.paused();
      
      console.log("\n⚙️ System Status:");
      console.log("├── Automation:", automationEnabled ? "Enabled" : "Disabled");
      console.log("└── Paused:", paused ? "Yes" : "No");

    } catch (error) {
      console.error("❌ Error fetching batch status:", error);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:submit-intent --budget 1000 --trades 10 --amount 100 --frequency 86400 --min-price 1500 --max-price 2000
 *   - npx hardhat --network sepolia task:submit-intent --budget 2000 --trades 20 --amount 100 --frequency 43200 --min-price 1600 --max-price 1900
 */
task("task:submit-intent", "Submit a DCA intent")
  .addParam("budget", "Total USDC budget (e.g., 1000 for 1000 USDC)")
  .addParam("trades", "Number of trades to execute")
  .addParam("amount", "USDC amount per trade (e.g., 100 for 100 USDC)")
  .addParam("frequency", "Frequency in seconds between trades (e.g., 86400 for daily)")
  .addParam("minPrice", "Minimum ETH price in dollars (e.g., 1500 for $1500)")
  .addParam("maxPrice", "Maximum ETH price in dollars (e.g., 2000 for $2000)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const budget = BigInt(taskArguments.budget) * 1000000n; // Convert to USDC format (6 decimals)
    const trades = parseInt(taskArguments.trades);
    const amount = BigInt(taskArguments.amount) * 1000000n; // Convert to USDC format
    const frequency = parseInt(taskArguments.frequency);
    const minPrice = BigInt(taskArguments.minPrice) * 100n; // Convert to cents
    const maxPrice = BigInt(taskArguments.maxPrice) * 100n; // Convert to cents

    if (!Number.isInteger(trades) || !Number.isInteger(frequency)) {
      throw new Error("Invalid arguments: trades and frequency must be integers");
    }

    await fhevm.initializeCLIApi();

    const intentCollectorDeployment = await deployments.get("IntentCollector");
    const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorDeployment.address);

    const signers = await ethers.getSigners();
    const signer = signers[0];

    console.log("📝 Submitting DCA Intent:");
    console.log("├── User:", signer.address);
    console.log("├── Budget:", taskArguments.budget, "USDC");
    console.log("├── Trades:", taskArguments.trades);
    console.log("├── Amount per Trade:", taskArguments.amount, "USDC");
    console.log("├── Frequency:", taskArguments.frequency, "seconds");
    console.log("├── Min Price: $" + taskArguments.minPrice);
    console.log("└── Max Price: $" + taskArguments.maxPrice);

    // Encrypt the intent parameters
    const encryptedInput = await fhevm
      .createEncryptedInput(intentCollectorDeployment.address, signer.address)
      .add64(budget)
      .add32(trades)
      .add64(amount)
      .add32(frequency)
      .add64(minPrice)
      .add64(maxPrice)
      .encrypt();

    const tx = await intentCollector
      .connect(signer)
      .submitIntent(
        encryptedInput.handles[0], encryptedInput.inputProof,
        encryptedInput.handles[1], encryptedInput.inputProof,
        encryptedInput.handles[2], encryptedInput.inputProof,
        encryptedInput.handles[3], encryptedInput.inputProof,
        encryptedInput.handles[4], encryptedInput.inputProof,
        encryptedInput.handles[5], encryptedInput.inputProof
      );

    console.log("\n⏳ Waiting for transaction:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Intent submitted successfully!");
    console.log("└── Gas used:", receipt?.gasUsed?.toString());

    // Show updated batch status
    const pendingCount = await intentCollector.getPendingIntentsCount();
    console.log("\n📊 Updated Status:");
    console.log("└── Pending intents:", pendingCount.toString());
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:process-batch --batch-id 1
 *   - npx hardhat --network sepolia task:process-batch --batch-id 1
 */
task("task:process-batch", "Manually trigger batch processing")
  .addParam("batchId", "Batch ID to process")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const batchId = parseInt(taskArguments.batchId);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      throw new Error("Invalid batch ID");
    }

    const batchProcessorDeployment = await deployments.get("BatchProcessor");
    const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorDeployment.address);

    const signers = await ethers.getSigners();
    const owner = signers[0];

    console.log("⚡ Processing Batch:", batchId);
    console.log("├── Processor:", batchProcessorDeployment.address);
    console.log("└── Owner:", owner.address);

    const tx = await batchProcessor.connect(owner).manualTriggerBatch(batchId);
    console.log("\n⏳ Waiting for transaction:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Batch processed successfully!");
    console.log("└── Gas used:", receipt?.gasUsed?.toString());

    // Show batch result
    try {
      const batchResult = await batchProcessor.getBatchResult(batchId);
      console.log("\n📊 Batch Result:");
      console.log("├── Success:", batchResult.success);
      console.log("├── Participants:", batchResult.participantCount.toString());
      console.log("├── Price at Execution: $" + (Number(batchResult.priceAtExecution) / 100).toFixed(2));
      console.log("├── Total Amount In:", ethers.formatUnits(batchResult.totalAmountIn, 6), "USDC");
      console.log("└── Total Amount Out:", ethers.formatEther(batchResult.totalAmountOut), "ETH");
    } catch (error) {
      console.log("⚠️ Could not fetch batch result");
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:user-balance
 *   - npx hardhat --network sepolia task:user-balance --user 0x1234...
 */
task("task:user-balance", "Check user's confidential token balance")
  .addOptionalParam("user", "User address (defaults to first signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const confidentialTokenDeployment = await deployments.get("ConfidentialToken");
    const confidentialToken = await ethers.getContractAt("ConfidentialToken", confidentialTokenDeployment.address);

    const signers = await ethers.getSigners();
    const userAddress = taskArguments.user || signers[0].address;

    console.log("💰 Checking Confidential Token Balance:");
    console.log("├── User:", userAddress);
    console.log("└── Token:", confidentialTokenDeployment.address);

    try {
      const encryptedBalance = await confidentialToken.balanceOf(userAddress);
      
      if (encryptedBalance === ethers.ZeroHash) {
        console.log("\n📊 Balance: 0 cETH (no encrypted balance)");
        return;
      }

      // Note: In a real implementation, only the user can decrypt their balance
      // This is for testing purposes only
      if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
        try {
          const clearBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            encryptedBalance,
            confidentialTokenDeployment.address,
            signers[0],
          );
          console.log("\n📊 Balance:", ethers.formatEther(clearBalance), "cETH");
        } catch (error) {
          console.log("\n📊 Balance: Encrypted (cannot decrypt)");
          console.log("└── Encrypted value:", encryptedBalance);
        }
      } else {
        console.log("\n📊 Balance: Encrypted (only user can decrypt)");
        console.log("└── Encrypted value:", encryptedBalance);
      }

      // Show total supply
      const totalSupply = await confidentialToken.totalSupply();
      console.log("└── Total Supply:", ethers.formatEther(totalSupply), "cETH");

    } catch (error) {
      console.error("❌ Error checking balance:", error);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:system-info
 *   - npx hardhat --network sepolia task:system-info
 */
task("task:system-info", "Display comprehensive system information")
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    console.log("🔍 DCA FHE Bot System Information");
    console.log("=" .repeat(50));

    try {
      // Get contract deployments
      const fundPoolDeployment = await deployments.get("FundPool");
      const intentCollectorDeployment = await deployments.get("IntentCollector");
      const batchProcessorDeployment = await deployments.get("BatchProcessor");

      // Get contract instances
      const fundPool = await ethers.getContractAt("FundPool", fundPoolDeployment.address);
      const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorDeployment.address);
      const batchProcessor = await ethers.getContractAt("BatchProcessor", batchProcessorDeployment.address);

      // Contract addresses
      console.log("\n📍 Contract Addresses:");
      console.log("├── FundPool:", fundPoolDeployment.address);
      console.log("├── IntentCollector:", intentCollectorDeployment.address);
      console.log("└── BatchProcessor:", batchProcessorDeployment.address);

      // System status
      console.log("\n📊 System Status:");
      const batchCounter = await intentCollector.batchCounter();
      const pendingCount = await intentCollector.getPendingIntentsCount();
      const lastProcessedBatch = await batchProcessor.lastProcessedBatch();
      const automationEnabled = await batchProcessor.automationEnabled();

      console.log("├── Current Batch:", batchCounter.toString());
      console.log("├── Pending Intents:", pendingCount.toString());
      console.log("├── Last Processed:", lastProcessedBatch.toString());
      console.log("└── Automation:", automationEnabled ? "Enabled" : "Disabled");

      // Fund Pool info
      console.log("\n💰 Fund Pool Info:");
      const poolBalance = await fundPool.getTotalPoolBalance();

      console.log("└── Total Pool Balance:", ethers.formatUnits(poolBalance, 6), "USDC");

      // Network info
      console.log("\n🌐 Network Info:");
      console.log("├── Network:", hre.network.name);
      console.log("├── Chain ID:", hre.network.config.chainId);
      console.log("└── FHEVM Mock:", hre.fhevm?.isMock ? "Yes" : "No");

    } catch (error) {
      console.error("❌ Error fetching system information:", error);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:deposit --amount 1000
 *   - npx hardhat --network sepolia task:deposit --amount 500
 */
task("task:deposit", "Deposit USDC to FundPool")
  .addParam("amount", "Amount of USDC to deposit (in USDC, not wei)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    const [signer] = await ethers.getSigners();

    try {
      const fundPoolDeployment = await deployments.get("FundPool");
      const fundPool = await ethers.getContractAt("FundPool", fundPoolDeployment.address);
      
      // Get USDC contract (MockERC20 on localhost, real USDC on other networks)
      let usdcAddress: string;
      if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
        const mockUSDCDeployment = await deployments.get("MockERC20");
        usdcAddress = mockUSDCDeployment.address;
      } else {
        // Use the USDC address configured in deployment
        usdcAddress = await fundPool.usdcToken();
      }
      
      const usdc = await ethers.getContractAt("MockERC20", usdcAddress);
      
      // Parse amount (USDC has 6 decimals)
      const amountInWei = ethers.parseUnits(taskArguments.amount.toString(), 6);
      
      console.log("💰 Depositing to FundPool:");
      console.log("├── User:", signer.address);
      console.log("├── Amount:", taskArguments.amount, "USDC");
      console.log("└── FundPool:", fundPoolDeployment.address);
      
      // Check current balance
      const currentBalance = await usdc.balanceOf(signer.address);
      console.log("├── Current USDC balance:", ethers.formatUnits(currentBalance, 6));
      
      if (currentBalance < amountInWei) {
        console.error("❌ Insufficient USDC balance!");
        return;
      }
      
      // Approve USDC spending
      console.log("📝 Approving USDC spending...");
      const approveTx = await usdc.approve(fundPoolDeployment.address, amountInWei);
      await approveTx.wait();
      console.log("✅ USDC approved");
      
      // Create encrypted amount for deposit
      const input = fhevm.createEncryptedInput(fundPoolDeployment.address, signer.address);
      input.add64(BigInt(amountInWei));
      const encryptedInput = input.encrypt();
      
      // For development, encode plaintext amount in proof (first 32 bytes)
      const proof = new Uint8Array(32);
      const amountBytes = ethers.toBeArray(amountInWei);
      proof.set(amountBytes, 32 - amountBytes.length);
      
      // Combine with the actual encrypted proof
      const fullProof = ethers.concat([proof, encryptedInput.inputProof]);
      
      // Deposit to FundPool
      console.log("🔐 Depositing with encrypted balance...");
      const depositTx = await fundPool.deposit(
        encryptedInput.handles[0],
        fullProof
      );
      await depositTx.wait();
      
      console.log("✅ Deposit successful!");
      
      // Check pool balance
      const poolBalance = await fundPool.getTotalPoolBalance();
      console.log("📊 Total pool balance:", ethers.formatUnits(poolBalance, 6), "USDC");
      
    } catch (error) {
      console.error("❌ Error depositing to FundPool:", error);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:withdraw --amount 100
 *   - npx hardhat --network sepolia task:withdraw --amount 50
 */
task("task:withdraw", "Withdraw USDC from FundPool")
  .addParam("amount", "Amount of USDC to withdraw (in USDC, not wei)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();

    try {
      const fundPoolDeployment = await deployments.get("FundPool");
      const fundPool = await ethers.getContractAt("FundPool", fundPoolDeployment.address);
      
      // Parse amount (USDC has 6 decimals)
      const amountInWei = ethers.parseUnits(taskArguments.amount.toString(), 6);
      
      console.log("💸 Withdrawing from FundPool:");
      console.log("├── User:", signer.address);
      console.log("├── Amount:", taskArguments.amount, "USDC");
      console.log("└── FundPool:", fundPoolDeployment.address);
      
      // Check if balance is initialized
      const isInitialized = await fundPool.isBalanceInitialized(signer.address);
      if (!isInitialized) {
        console.error("❌ No balance initialized for this user!");
        return;
      }
      
      // Create a dummy proof (in production, this would be a ZK proof)
      const proof = new Uint8Array(32);
      
      // Withdraw from FundPool
      console.log("🔓 Withdrawing from encrypted balance...");
      const withdrawTx = await fundPool.withdraw(amountInWei, proof);
      await withdrawTx.wait();
      
      console.log("✅ Withdrawal successful!");
      
      // Check pool balance
      const poolBalance = await fundPool.getTotalPoolBalance();
      console.log("📊 Total pool balance:", ethers.formatUnits(poolBalance, 6), "USDC");
      
    } catch (error) {
      console.error("❌ Error withdrawing from FundPool:", error);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:fund-balance
 *   - npx hardhat --network localhost task:fund-balance --user 0x1234...
 */
task("task:fund-balance", "Check user's FundPool balance")
  .addOptionalParam("user", "User address to check (defaults to signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    const [signer] = await ethers.getSigners();

    try {
      const fundPoolDeployment = await deployments.get("FundPool");
      const fundPool = await ethers.getContractAt("FundPool", fundPoolDeployment.address);
      
      const userAddress = taskArguments.user || signer.address;
      
      console.log("💰 FundPool Balance Check:");
      console.log("├── User:", userAddress);
      console.log("└── FundPool:", fundPoolDeployment.address);
      
      // Check if balance is initialized
      const isInitialized = await fundPool.isBalanceInitialized(userAddress);
      
      if (!isInitialized) {
        console.log("⚠️  No balance initialized for this user");
      } else {
        console.log("✅ Balance is initialized (encrypted)");
        
        // Note: We can't decrypt the balance without proper FHE decryption
        // In production, this would require the user's private key or a decryption oracle
        if (userAddress === signer.address && fhevm.isMock) {
          // In mock mode, we can try to decrypt
          try {
            const encryptedBalance = await fundPool.getEncryptedBalance(userAddress);
            const decryptedBalance = await fhevm.userDecrypt(
              FhevmType.euint64,
              encryptedBalance,
              fundPoolDeployment.address,
              signer
            );
            console.log("📊 Decrypted balance:", ethers.formatUnits(decryptedBalance, 6), "USDC (mock mode only)");
          } catch (e) {
            console.log("ℹ️  Cannot decrypt balance (encrypted for privacy)");
          }
        } else {
          console.log("ℹ️  Balance is encrypted and cannot be viewed");
        }
      }
      
      // Show total pool balance
      const poolBalance = await fundPool.getTotalPoolBalance();
      console.log("📊 Total pool balance:", ethers.formatUnits(poolBalance, 6), "USDC");
      
    } catch (error) {
      console.error("❌ Error checking FundPool balance:", error);
    }
  });

/**
 * Set minimum batch size for IntentCollector
 * Example:
 *   - npx hardhat --network localhost task:set-min-batch-size --size 2
 *   - npx hardhat --network sepolia task:set-min-batch-size --size 3
 */
task("task:set-min-batch-size", "Set minimum batch size for IntentCollector")
  .addParam("size", "New minimum batch size (1-100)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();

    try {
      const newMinBatchSize = parseInt(taskArguments.size);
      
      if (newMinBatchSize < 1 || newMinBatchSize > 100) {
        throw new Error("MinBatchSize must be between 1 and 100");
      }
      
      console.log("🔧 Setting MinBatchSize...");
      console.log("├── Deployer:", signer.address);
      console.log("└── New size:", newMinBatchSize);
      
      const intentCollectorDeployment = await deployments.get("IntentCollector");
      const intentCollector = await ethers.getContractAt("IntentCollector", intentCollectorDeployment.address);
      
      // Check current value
      const currentMinBatchSize = await intentCollector.minBatchSize();
      console.log("📊 Current MinBatchSize:", currentMinBatchSize.toString());
      
      if (currentMinBatchSize.toString() === newMinBatchSize.toString()) {
        console.log("✅ MinBatchSize is already set to", newMinBatchSize);
        return;
      }
      
      // Set new value
      console.log("⏳ Updating MinBatchSize...");
      const tx = await intentCollector.setMinBatchSize(newMinBatchSize);
      console.log("📝 Transaction hash:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
      
      // Verify the change
      const updatedMinBatchSize = await intentCollector.minBatchSize();
      console.log("🎉 Updated MinBatchSize:", updatedMinBatchSize.toString());
      
      if (updatedMinBatchSize.toString() === newMinBatchSize.toString()) {
        console.log("✅ MinBatchSize successfully updated!");
      } else {
        console.log("❌ MinBatchSize update failed!");
      }
      
    } catch (error) {
      console.error("❌ Error setting MinBatchSize:", error);
    }
  });
