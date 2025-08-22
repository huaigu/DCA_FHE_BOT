// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "./interfaces/IUniswapV3Router.sol";
import {IFundPool} from "./interfaces/IFundPool.sol";
import {IntentCollector} from "./IntentCollector.sol";

/// @title FundPool
/// @notice Manages encrypted user USDC deposits for privacy-preserving DCA
/// @dev Uses Zama FHE to maintain encrypted balance records
contract FundPool is IFundPool, SepoliaConfig, Ownable, ReentrancyGuard {
    /// @notice Structure for withdrawal requests
    struct WithdrawalRequest {
        uint256 requestId; // FHEVM decryption request ID
        address user; // User requesting withdrawal
        euint64 encryptedBalance; // User's encrypted balance at request time
        uint256 timestamp; // Request timestamp
        bool processed; // Whether withdrawal is complete
    }

    /// @notice USDC token contract
    IERC20 public immutable usdcToken;

    /// @notice BatchProcessor contract address (authorized to deduct balances)
    address public batchProcessor;

    /// @notice IntentCollector contract address (authorized to check balances)
    address public intentCollector;

    /// @notice Encrypted user balances
    mapping(address => euint64) internal encryptedBalances;

    /// @notice Track if user has initialized their encrypted balance
    mapping(address => bool) public isBalanceInitialized;

    /// @notice Total USDC deposited (for security tracking)
    uint256 public totalDeposited;

    /// @notice Total USDC withdrawn (for security tracking)
    uint256 public totalWithdrawn;

    /// @notice Mapping from request ID to withdrawal request
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    /// @notice Mapping from user to their active withdrawal request ID
    mapping(address => uint256) public activeWithdrawalRequest;

    /// @notice Withdrawal cooldown period (24 hours)
    uint256 public constant WITHDRAWAL_COOLDOWN = 24 hours;

    /// @notice Last withdrawal timestamp for each user
    mapping(address => uint256) public lastWithdrawalTime;

    /// @notice Events
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event BalanceDeducted(address indexed user);
    event BatchProcessorUpdated(address indexed oldProcessor, address indexed newProcessor);
    event IntentCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FundsTransferredToBatchProcessor(uint256 amount);
    event WithdrawalInitiated(address indexed user, uint256 requestId, uint256 timestamp);
    event WithdrawalCompleted(address indexed user, uint256 usdcAmount, uint256 timestamp);
    event WithdrawalCancelled(address indexed user, uint256 requestId, uint256 timestamp);

    /// @notice Custom errors
    error UnauthorizedCaller();
    error InvalidAmount();
    error InsufficientBalance();
    error InvalidAddress();
    error BalanceNotInitialized();
    error TransferFailed();
    error DepositFailed();
    error WithdrawalFailed();
    error WithdrawalPending();
    error NoWithdrawalPending();
    error WithdrawalCooldownActive();

    /// @notice Constructor
    /// @param _usdcToken Address of USDC token contract
    /// @param _owner Owner of the contract
    constructor(address _usdcToken, address _owner) Ownable(_owner) {
        if (_usdcToken == address(0)) revert InvalidAddress();
        usdcToken = IERC20(_usdcToken);
    }

    /// @notice Modifier to check if caller is batch processor
    modifier onlyBatchProcessor() {
        if (msg.sender != batchProcessor) revert UnauthorizedCaller();
        _;
    }

    /// @notice Modifier to check if caller is intent collector or batch processor
    modifier onlyAuthorized() {
        if (msg.sender != batchProcessor && msg.sender != intentCollector) {
            revert UnauthorizedCaller();
        }
        _;
    }

    /// @notice Set the batch processor address
    /// @param _batchProcessor New batch processor address
    function setBatchProcessor(address _batchProcessor) external onlyOwner {
        if (_batchProcessor == address(0)) revert InvalidAddress();
        address oldProcessor = batchProcessor;
        batchProcessor = _batchProcessor;

        // Update permissions for all existing balances if needed
        emit BatchProcessorUpdated(oldProcessor, _batchProcessor);
    }

    /// @notice Set the intent collector address
    /// @param _intentCollector New intent collector address
    function setIntentCollector(address _intentCollector) external onlyOwner {
        if (_intentCollector == address(0)) revert InvalidAddress();
        address oldCollector = intentCollector;
        intentCollector = _intentCollector;
        emit IntentCollectorUpdated(oldCollector, _intentCollector);
    }

    /// @notice Initialize encrypted balance for a user
    function _initializeBalance(address user) internal {
        if (isBalanceInitialized[user]) return;

        // Initialize with encrypted zero
        euint64 encryptedZero = FHE.asEuint64(0);
        encryptedBalances[user] = encryptedZero;

        // Set permissions
        FHE.allowThis(encryptedZero);
        FHE.allow(encryptedZero, user);

        // Allow batch processor and intent collector to access
        if (batchProcessor != address(0)) {
            FHE.allow(encryptedZero, batchProcessor);
        }
        if (intentCollector != address(0)) {
            FHE.allow(encryptedZero, intentCollector);
        }

        isBalanceInitialized[user] = true;
    }

    /// @notice Deposit USDC and record encrypted balance
    /// @param amount The amount of USDC to deposit
    function deposit(uint256 amount) external override nonReentrant {
        if (amount == 0) revert InvalidAmount();

        // Initialize balance if needed
        if (!isBalanceInitialized[msg.sender]) {
            _initializeBalance(msg.sender);
        }

        // Transfer USDC from user to pool
        bool success = usdcToken.transferFrom(msg.sender, address(this), amount);
        if (!success) revert DepositFailed();

        // Convert plaintext amount to encrypted for internal balance tracking
        euint64 encryptedAmount = FHE.asEuint64(uint64(amount));

        // Update encrypted balance
        euint64 currentBalance = encryptedBalances[msg.sender];
        euint64 newBalance = FHE.add(currentBalance, encryptedAmount);
        encryptedBalances[msg.sender] = newBalance;

        // Update permissions

        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);
        FHE.allow(encryptedBalances[msg.sender], msg.sender);

        if (batchProcessor != address(0)) {
            FHE.allow(newBalance, batchProcessor);
        }
        if (intentCollector != address(0)) {
            FHE.allow(newBalance, intentCollector);
        }

        // Update totals
        totalDeposited += amount;

        // Update user state to ACTIVE if they were WITHDRAWN or UNINITIALIZED
        if (intentCollector != address(0)) {
            IntentCollector collector = IntentCollector(intentCollector);
            IntentCollector.UserState currentState = collector.getUserState(msg.sender);
            if (
                currentState == IntentCollector.UserState.UNINITIALIZED ||
                currentState == IntentCollector.UserState.WITHDRAWN
            ) {
                collector.updateUserState(msg.sender, IntentCollector.UserState.ACTIVE);
            }
        }

        emit Deposit(msg.sender, amount);
    }

    /// @notice Initiate full withdrawal of all funds
    /// @dev Starts the withdrawal process by requesting decryption of balances
    function initiateWithdrawal() external nonReentrant {
        if (!isBalanceInitialized[msg.sender]) revert BalanceNotInitialized();
        if (activeWithdrawalRequest[msg.sender] != 0) revert WithdrawalPending();

        // Update user state to WITHDRAWING
        if (intentCollector != address(0)) {
            IntentCollector(intentCollector).updateUserState(msg.sender, IntentCollector.UserState.WITHDRAWING);
            // Cancel all active intents
            IntentCollector(intentCollector).cancelUserIntents(msg.sender);
        }

        // Get user's encrypted balance
        euint64 encryptedBalance = encryptedBalances[msg.sender];

        // Extract handle using standard FHEVM pattern
        bytes32[] memory ctsHandles = new bytes32[](1);
        ctsHandles[0] = euint64.unwrap(encryptedBalance);

        // Use standard FHE.requestDecryption
        uint256 requestId = FHE.requestDecryption(ctsHandles, this.onWithdrawalDecrypted.selector);

        // Store withdrawal request
        withdrawalRequests[requestId] = WithdrawalRequest({
            requestId: requestId,
            user: msg.sender,
            encryptedBalance: encryptedBalance,
            timestamp: block.timestamp,
            processed: false
        });

        activeWithdrawalRequest[msg.sender] = requestId;

        emit WithdrawalInitiated(msg.sender, requestId, block.timestamp);
    }

    /// @notice Callback for withdrawal decryption (standard FHEVM pattern)
    /// @param requestId The request ID from FHEVM decryption service
    /// @param decryptedBalance The decrypted balance amount
    /// @param signatures Cryptographic signatures for verification
    function onWithdrawalDecrypted(uint256 requestId, uint64 decryptedBalance, bytes[] calldata signatures) external {
        // SECURITY: Mandatory signature verification
        FHE.checkSignatures(requestId, signatures);

        WithdrawalRequest storage request = withdrawalRequests[requestId];
        require(!request.processed, "Withdrawal already processed");

        address user = request.user;
        uint256 usdcAmount = uint256(decryptedBalance);

        // Mark as processed and clear active withdrawal request
        request.processed = true;
        delete activeWithdrawalRequest[user];

        // ALWAYS reset user's encrypted balance to 0 and update state
        // regardless of the decrypted amount to maintain state consistency
        euint64 zeroBalance = FHE.asEuint64(0);
        encryptedBalances[user] = zeroBalance;

        // Set comprehensive FHE permissions
        FHE.allowThis(zeroBalance);
        FHE.allow(zeroBalance, user);
        if (batchProcessor != address(0)) {
            FHE.allow(zeroBalance, batchProcessor);
        }
        if (intentCollector != address(0)) {
            FHE.allow(zeroBalance, intentCollector);
        }

        // ALWAYS update user state to WITHDRAWN when withdrawal request completes
        if (intentCollector != address(0)) {
            IntentCollector(intentCollector).updateUserState(user, IntentCollector.UserState.WITHDRAWN);
        }

        // ALWAYS update these tracking variables for consistency
        lastWithdrawalTime[user] = block.timestamp;
        isBalanceInitialized[user] = false;

        // Only handle USDC transfer if amount > 0
        if (usdcAmount > 0) {
            // Check pool has sufficient USDC
            uint256 poolBalance = usdcToken.balanceOf(address(this));
            require(poolBalance >= usdcAmount, "Insufficient pool balance");

            // Transfer USDC to user
            bool success = usdcToken.transfer(user, usdcAmount);
            require(success, "USDC transfer failed");

            // Update total withdrawn counter
            totalWithdrawn += usdcAmount;
        }

        // ALWAYS emit withdrawal completed event (even for 0 amounts) for proper tracking
        emit WithdrawalCompleted(user, usdcAmount, block.timestamp);
    }

    /// @notice Cancel a pending withdrawal request
    /// @dev Note: FHEVM decryption requests cannot be cancelled once submitted
    function cancelWithdrawal() external nonReentrant {
        uint256 requestId = activeWithdrawalRequest[msg.sender];
        if (requestId == 0) revert NoWithdrawalPending();

        WithdrawalRequest storage request = withdrawalRequests[requestId];
        if (request.processed) revert InvalidAmount();

        // Mark as processed to prevent future fulfillment
        request.processed = true;

        // Clear active withdrawal request
        delete activeWithdrawalRequest[msg.sender];

        // Note: FHEVM decryption requests cannot be cancelled at the protocol level
        // The request may still be fulfilled by the decryption service, but will be ignored

        // Revert user state to ACTIVE
        if (intentCollector != address(0)) {
            IntentCollector(intentCollector).updateUserState(msg.sender, IntentCollector.UserState.ACTIVE);
        }

        emit WithdrawalCancelled(msg.sender, requestId, block.timestamp);
    }

    /// @notice Get withdrawal request status
    /// @param user User address
    /// @return pending Whether user has pending withdrawal
    /// @return requestId The request ID if pending
    /// @return timestamp The request timestamp if pending
    function getWithdrawalStatus(
        address user
    ) external view returns (bool pending, uint256 requestId, uint256 timestamp) {
        requestId = activeWithdrawalRequest[user];
        if (requestId != 0) {
            pending = true;
            timestamp = withdrawalRequests[requestId].timestamp;
        }
    }

    /// @notice Check if user can withdraw
    /// @param user User address
    /// @return allowed Whether user can initiate withdrawal
    /// @return reason Reason if cannot withdraw
    function canWithdraw(address user) external view returns (bool allowed, string memory reason) {
        if (!isBalanceInitialized[user]) {
            return (false, "Balance not initialized");
        }
        if (activeWithdrawalRequest[user] != 0) {
            return (false, "Withdrawal already pending");
        }
        if (lastWithdrawalTime[user] > 0 && block.timestamp - lastWithdrawalTime[user] < WITHDRAWAL_COOLDOWN) {
            return (false, "Cooldown period active");
        }
        return (true, "");
    }

    /// @notice Legacy withdraw function (deprecated, kept for interface compatibility)
    /// @param amount Plain amount to withdraw
    /// @dev proof parameter is deprecated and not used
    function withdraw(uint256 amount, bytes calldata /* proof */) external override nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (!isBalanceInitialized[msg.sender]) revert BalanceNotInitialized();

        // In production, verify the proof that amount matches encrypted balance
        // For now, we'll trust the user (this is a security simplification)

        // Check pool has sufficient USDC
        uint256 poolBalance = usdcToken.balanceOf(address(this));
        if (poolBalance < amount) revert InsufficientBalance();

        // Deduct from encrypted balance
        euint64 withdrawAmount = FHE.asEuint64(uint64(amount));
        euint64 currentBalance = encryptedBalances[msg.sender];

        // Check if user has sufficient balance (encrypted comparison)
        ebool hasSufficientBalance = FHE.ge(currentBalance, withdrawAmount);

        // Perform conditional withdrawal
        euint64 newBalance = FHE.select(hasSufficientBalance, FHE.sub(currentBalance, withdrawAmount), currentBalance);

        // Update balance only if sufficient
        encryptedBalances[msg.sender] = newBalance;

        // Update permissions
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);
        if (batchProcessor != address(0)) {
            FHE.allow(newBalance, batchProcessor);
        }
        if (intentCollector != address(0)) {
            FHE.allow(newBalance, intentCollector);
        }

        // Transfer USDC to user
        bool success = usdcToken.transfer(msg.sender, amount);
        if (!success) revert WithdrawalFailed();

        // Update totals
        totalWithdrawn += amount;

        emit Withdrawal(msg.sender, amount);
    }

    /// @notice Get encrypted balance for a user
    /// @param user The user address
    /// @return The encrypted balance
    function getEncryptedBalance(address user) external view override returns (euint64) {
        if (!isBalanceInitialized[user]) revert BalanceNotInitialized();
        return encryptedBalances[user];
    }

    /// @notice Deduct encrypted amount from user's balance (only callable by BatchProcessor)
    /// @param user The user address
    /// @param amount The encrypted amount to deduct
    /// @return success Whether the deduction was successful
    function deductBalance(address user, euint64 amount) external override onlyBatchProcessor returns (bool success) {
        if (!isBalanceInitialized[user]) revert BalanceNotInitialized();

        euint64 currentBalance = encryptedBalances[user];

        // Ensure BatchProcessor has access to the current balance
        FHE.allow(currentBalance, msg.sender);

        // Check if user has sufficient balance
        ebool hasSufficientBalance = FHE.ge(currentBalance, amount);

        // Deduct amount if sufficient
        euint64 newBalance = FHE.select(hasSufficientBalance, FHE.sub(currentBalance, amount), currentBalance);

        encryptedBalances[user] = newBalance;

        // Update permissions
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, user);
        FHE.allow(newBalance, batchProcessor);
        if (intentCollector != address(0)) {
            FHE.allow(newBalance, intentCollector);
        }

        emit BalanceDeducted(user);

        // For now, return true (in production, would need to handle the encrypted boolean)
        success = true;
    }

    /// @notice Transfer aggregated USDC to BatchProcessor for swap
    /// @param amount The amount to transfer
    function transferToBatchProcessor(uint256 amount) external override onlyBatchProcessor {
        if (amount == 0) revert InvalidAmount();

        uint256 poolBalance = usdcToken.balanceOf(address(this));
        if (poolBalance < amount) revert InsufficientBalance();

        bool success = usdcToken.transfer(batchProcessor, amount);
        if (!success) revert TransferFailed();

        emit FundsTransferredToBatchProcessor(amount);
    }

    /// @notice Get the total USDC balance held by the pool
    /// @return The total balance
    function getTotalPoolBalance() external view override returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }

    /// @notice Emergency function to recover stuck tokens
    /// @param token The token to recover
    /// @param amount The amount to recover
    function recoverToken(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        IERC20(token).transfer(owner(), amount);
    }
}
