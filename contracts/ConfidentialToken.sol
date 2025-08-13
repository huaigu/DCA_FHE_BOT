// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "./interfaces/IUniswapV3Router.sol";

/// @title ConfidentialToken
/// @notice ERC20-compatible token with encrypted balances using Zama FHE
/// @dev Extends standard ERC20 functionality with encrypted balance management for privacy-preserving DCA
contract ConfidentialToken is SepoliaConfig, Ownable, ReentrancyGuard {
    /// @notice Token metadata
    string public name;
    string public symbol;
    uint8 public decimals;
    
    /// @notice Total supply (public, but individual balances are encrypted)
    uint256 public totalSupply;
    
    /// @notice Encrypted balances mapping
    mapping(address => euint64) internal _encryptedBalances;
    
    /// @notice Standard ERC20 allowances (not encrypted for compatibility)
    mapping(address => mapping(address => uint256)) public allowances;
    
    /// @notice Address of the batch processor (authorized to mint/distribute)
    address public batchProcessor;
    
    /// @notice Address of the underlying token (e.g., ETH received from swaps)
    address public underlyingToken;
    
    /// @notice Mapping to track if user has initialized their encrypted balance
    mapping(address => bool) public isBalanceInitialized;

    /// @notice Events (compatible with ERC20)
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event EncryptedTransfer(address indexed from, address indexed to);
    event BalanceDistributed(address indexed user, uint256 batchId);
    event BatchProcessorUpdated(address indexed oldProcessor, address indexed newProcessor);

    /// @notice Custom errors
    error UnauthorizedCaller();
    error InvalidAmount();
    error InsufficientBalance();
    error InvalidAddress();
    error BalanceNotInitialized();
    error TransferFailed();

    /// @notice Constructor
    /// @param _name Token name
    /// @param _symbol Token symbol
    /// @param _decimals Token decimals
    /// @param _underlyingToken Address of underlying token
    /// @param _owner Owner of the contract
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _underlyingToken,
        address _owner
    ) Ownable(_owner) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        underlyingToken = _underlyingToken;
    }

    /// @notice Modifier to check if caller is batch processor
    modifier onlyBatchProcessor() {
        if (msg.sender != batchProcessor) revert UnauthorizedCaller();
        _;
    }

    /// @notice Initialize encrypted balance for a user (required before first use)
    /// @dev Must be called before user can receive encrypted tokens
    function initializeBalance() external {
        if (isBalanceInitialized[msg.sender]) return;
        
        // Initialize with encrypted zero
        euint64 encryptedZero = FHE.asEuint64(0);
        _encryptedBalances[msg.sender] = encryptedZero;
        
        // Set permissions
        FHE.allowThis(encryptedZero);
        FHE.allow(encryptedZero, msg.sender);
        if (batchProcessor != address(0)) {
            FHE.allow(encryptedZero, batchProcessor);
        }
        
        isBalanceInitialized[msg.sender] = true;
    }

    /// @notice Get encrypted balance for a user
    /// @param user The user address
    /// @return The encrypted balance
    function balanceOf(address user) external view returns (euint64) {
        if (!isBalanceInitialized[user]) revert BalanceNotInitialized();
        return _encryptedBalances[user];
    }

    /// @notice Distribute encrypted tokens to users (called by batch processor)
    /// @param users Array of user addresses
    /// @param encryptedAmounts Array of encrypted amounts to distribute
    /// @param batchId The batch ID for tracking
    function distributeTokens(
        address[] calldata users,
        euint64[] calldata encryptedAmounts,
        uint256 batchId
    ) external onlyBatchProcessor nonReentrant {
        if (users.length != encryptedAmounts.length) revert InvalidAmount();
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            euint64 amount = encryptedAmounts[i];
            
            if (user == address(0)) revert InvalidAddress();
            
            // Grant this contract permission to use the amount
            FHE.allowThis(amount);
            
            // Initialize balance if not already done
            if (!isBalanceInitialized[user]) {
                euint64 encryptedZero = FHE.asEuint64(0);
                _encryptedBalances[user] = encryptedZero;
                FHE.allowThis(encryptedZero);
                FHE.allow(encryptedZero, user);
                FHE.allow(encryptedZero, batchProcessor);
                isBalanceInitialized[user] = true;
            }
            
            // Add to user's encrypted balance
            _encryptedBalances[user] = FHE.add(_encryptedBalances[user], amount);
            
            // Update permissions
            FHE.allowThis(_encryptedBalances[user]);
            FHE.allow(_encryptedBalances[user], user);
            FHE.allow(_encryptedBalances[user], batchProcessor);
            
            emit BalanceDistributed(user, batchId);
            emit EncryptedTransfer(address(0), user);
        }
    }

    /// @notice Transfer encrypted tokens between users
    /// @param to Recipient address
    /// @param encryptedAmount Encrypted amount to transfer
    /// @param proof Proof for the encrypted amount
    function encryptedTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata proof
    ) external nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (!isBalanceInitialized[msg.sender]) revert BalanceNotInitialized();
        
        // Convert external encrypted input
        euint64 amount = FHE.fromExternal(encryptedAmount, proof);
        
        // Initialize recipient balance if needed
        if (!isBalanceInitialized[to]) {
            euint64 encryptedZero = FHE.asEuint64(0);
            _encryptedBalances[to] = encryptedZero;
            FHE.allowThis(encryptedZero);
            FHE.allow(encryptedZero, to);
            if (batchProcessor != address(0)) {
                FHE.allow(encryptedZero, batchProcessor);
            }
            isBalanceInitialized[to] = true;
        }
        
        // Check if sender has sufficient balance (encrypted comparison)
        ebool hasSufficientBalance = FHE.ge(_encryptedBalances[msg.sender], amount);
        
        // Perform conditional transfer
        euint64 newSenderBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(_encryptedBalances[msg.sender], amount),
            _encryptedBalances[msg.sender]
        );
        
        euint64 newRecipientBalance = FHE.select(
            hasSufficientBalance,
            FHE.add(_encryptedBalances[to], amount),
            _encryptedBalances[to]
        );
        
        // Update balances
        _encryptedBalances[msg.sender] = newSenderBalance;
        _encryptedBalances[to] = newRecipientBalance;
        
        // Update permissions
        FHE.allowThis(newSenderBalance);
        FHE.allowThis(newRecipientBalance);
        FHE.allow(newSenderBalance, msg.sender);
        FHE.allow(newRecipientBalance, to);
        
        if (batchProcessor != address(0)) {
            FHE.allow(newSenderBalance, batchProcessor);
            FHE.allow(newRecipientBalance, batchProcessor);
        }
        
        emit EncryptedTransfer(msg.sender, to);
    }

    /// @notice Withdraw underlying tokens (user must provide decrypted amount)
    /// @param amount The amount to withdraw (must match encrypted balance)
    /// @param encryptedProof Proof that the amount matches encrypted balance
    function withdraw(uint256 amount, bytes calldata encryptedProof) external nonReentrant {
        if (!isBalanceInitialized[msg.sender]) revert BalanceNotInitialized();
        if (amount == 0) revert InvalidAmount();
        
        // Note: In a production system, you would need to verify the proof
        // that the provided amount matches the user's encrypted balance
        // This is simplified for demonstration
        
        // For now, we'll assume the proof is valid and proceed
        // In practice, you'd implement zero-knowledge proof verification
        
        // Transfer underlying tokens to user
        if (underlyingToken == address(0)) {
            // ETH transfer
            (bool success, ) = msg.sender.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            // ERC20 transfer
            IERC20(underlyingToken).transfer(msg.sender, amount);
        }
        
        // Reduce encrypted balance by withdrawn amount
        euint64 withdrawAmount = FHE.asEuint64(uint64(amount));
        _encryptedBalances[msg.sender] = FHE.sub(_encryptedBalances[msg.sender], withdrawAmount);
        
        // Update permissions
        FHE.allowThis(_encryptedBalances[msg.sender]);
        FHE.allow(_encryptedBalances[msg.sender], msg.sender);
        if (batchProcessor != address(0)) {
            FHE.allow(_encryptedBalances[msg.sender], batchProcessor);
        }
        
        emit EncryptedTransfer(msg.sender, address(0));
        emit Transfer(msg.sender, address(0), amount);
    }

    /// @notice Mint tokens to contract (called when receiving underlying tokens)
    /// @param amount Amount to mint
    function mint(uint256 amount) external onlyBatchProcessor {
        totalSupply += amount;
    }

    /// @notice Burn tokens from contract supply
    /// @param amount Amount to burn
    function burn(uint256 amount) external onlyBatchProcessor {
        if (amount > totalSupply) revert InvalidAmount();
        totalSupply -= amount;
    }

    /// @notice Set batch processor address
    /// @param _batchProcessor Address of the batch processor
    function setBatchProcessor(address _batchProcessor) external onlyOwner {
        if (_batchProcessor == address(0)) revert InvalidAddress();
        
        address oldProcessor = batchProcessor;
        batchProcessor = _batchProcessor;
        
        emit BatchProcessorUpdated(oldProcessor, _batchProcessor);
    }

    /// @notice ERC20 compatibility - approve spending (not encrypted)
    /// @param spender The spender address
    /// @param amount The amount to approve
    /// @return True if successful
    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /// @notice ERC20 compatibility - get allowance
    /// @param owner The owner address
    /// @param spender The spender address
    /// @return The allowance amount
    function allowance(address owner, address spender) external view returns (uint256) {
        return allowances[owner][spender];
    }

    /// @notice Check if contract can receive ETH
    receive() external payable {
        // Allow contract to receive ETH for underlying token operations
    }

    /// @notice Emergency function to recover stuck tokens
    /// @param token Token address (address(0) for ETH)
    /// @param amount Amount to recover
    function emergencyRecover(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }
}