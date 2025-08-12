// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "./interfaces/IUniswapV3Router.sol";
import {IFundPool} from "./interfaces/IFundPool.sol";

/// @title FundPool
/// @notice Manages encrypted user USDC deposits for privacy-preserving DCA
/// @dev Uses Zama FHE to maintain encrypted balance records
contract FundPool is IFundPool, SepoliaConfig, Ownable, ReentrancyGuard {
    /// @notice USDC token contract
    IERC20 public immutable usdcToken;
    
    /// @notice BatchProcessor contract address (authorized to deduct balances)
    address public batchProcessor;
    
    /// @notice IntentCollector contract address (authorized to check balances)
    address public intentCollector;
    
    /// @notice Encrypted user balances
    mapping(address => euint64) private encryptedBalances;
    
    /// @notice Track if user has initialized their encrypted balance
    mapping(address => bool) public isBalanceInitialized;
    
    /// @notice Total USDC deposited (for security tracking)
    uint256 public totalDeposited;
    
    /// @notice Total USDC withdrawn (for security tracking)
    uint256 public totalWithdrawn;
    
    /// @notice Events
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event BalanceDeducted(address indexed user);
    event BatchProcessorUpdated(address indexed oldProcessor, address indexed newProcessor);
    event IntentCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FundsTransferredToBatchProcessor(uint256 amount);
    
    /// @notice Custom errors
    error UnauthorizedCaller();
    error InvalidAmount();
    error InsufficientBalance();
    error InvalidAddress();
    error BalanceNotInitialized();
    error TransferFailed();
    error DepositFailed();
    error WithdrawalFailed();
    
    /// @notice Constructor
    /// @param _usdcToken Address of USDC token contract
    /// @param _owner Owner of the contract
    constructor(
        address _usdcToken,
        address _owner
    ) Ownable(_owner) {
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
    /// @param amountExt Encrypted amount to deposit
    /// @param amountProof Proof for the encrypted amount
    function deposit(
        externalEuint64 amountExt,
        bytes calldata amountProof
    ) external override nonReentrant {
        // Convert external encrypted amount to internal
        euint64 encryptedAmount = FHE.fromExternal(amountExt, amountProof);
        
        // For the actual transfer, we need the plaintext amount
        // In production, this would use a more sophisticated mechanism
        // For now, we'll require the user to also provide the plaintext amount separately
        // This is a simplification - in production, you'd use ZK proofs or oracle-based verification
        uint256 plaintextAmount = _getPlaintextAmount(amountExt, amountProof);
        
        if (plaintextAmount == 0) revert InvalidAmount();
        
        // Initialize balance if needed
        if (!isBalanceInitialized[msg.sender]) {
            _initializeBalance(msg.sender);
        }
        
        // Transfer USDC from user to pool
        bool success = usdcToken.transferFrom(msg.sender, address(this), plaintextAmount);
        if (!success) revert DepositFailed();
        
        // Update encrypted balance
        euint64 currentBalance = encryptedBalances[msg.sender];
        euint64 newBalance = FHE.add(currentBalance, encryptedAmount);
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
        
        // Update totals
        totalDeposited += plaintextAmount;
        
        emit Deposit(msg.sender, plaintextAmount);
    }
    
    /// @notice Withdraw USDC from encrypted balance
    /// @param amount Plain amount to withdraw
    /// @param proof Proof that amount matches encrypted balance (simplified for now)
    function withdraw(
        uint256 amount,
        bytes calldata proof
    ) external override nonReentrant {
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
        euint64 newBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(currentBalance, withdrawAmount),
            currentBalance
        );
        
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
    function deductBalance(
        address user,
        euint64 amount
    ) external override onlyBatchProcessor returns (bool success) {
        if (!isBalanceInitialized[user]) revert BalanceNotInitialized();
        
        euint64 currentBalance = encryptedBalances[user];
        
        // Check if user has sufficient balance
        ebool hasSufficientBalance = FHE.ge(currentBalance, amount);
        
        // Deduct amount if sufficient
        euint64 newBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(currentBalance, amount),
            currentBalance
        );
        
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
    
    /// @notice Helper function to extract plaintext amount (simplified for development)
    /// @dev In production, this would use ZK proofs or oracle-based verification
    function _getPlaintextAmount(
        externalEuint64 amountExt,
        bytes calldata amountProof
    ) internal pure returns (uint256) {
        // For development, we'll encode the plaintext amount in the proof
        // First 32 bytes of proof contain the plaintext amount
        if (amountProof.length < 32) revert InvalidAmount();
        
        uint256 amount;
        assembly {
            amount := calldataload(add(amountProof.offset, 0))
        }
        
        return amount;
    }
    
    /// @notice Emergency function to recover stuck tokens
    /// @param token The token to recover
    /// @param amount The amount to recover
    function recoverToken(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        IERC20(token).transfer(owner(), amount);
    }
}