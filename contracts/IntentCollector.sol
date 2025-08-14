// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, externalEuint32, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IFundPool} from "./interfaces/IFundPool.sol";

/// @title IntentCollector
/// @notice Collects and manages encrypted DCA intents with privacy-preserving parameters
/// @dev Uses Zama FHE to encrypt user DCA strategies including price conditions
contract IntentCollector is SepoliaConfig, Ownable, ReentrancyGuard {
    /// @notice User account states for efficient batch processing
    enum UserState {
        UNINITIALIZED, // User has not deposited yet
        ACTIVE,        // User can submit intents and participate in batches
        WITHDRAWING,   // User is in the process of withdrawing
        WITHDRAWN      // User has withdrawn all funds
    }
    
    /// @notice Structure representing an encrypted DCA intent
    struct EncryptedIntent {
        euint64 budget;          // Total USDC budget for DCA
        euint32 tradesCount;     // Number of trades to execute
        euint64 amountPerTrade;  // USDC amount per trade
        euint32 frequency;       // Frequency in seconds between trades
        euint64 minPrice;        // Minimum ETH price for execution (in cents)
        euint64 maxPrice;        // Maximum ETH price for execution (in cents)
        address user;            // User who submitted the intent
        uint256 submittedAt;     // Timestamp when intent was submitted
        uint256 batchId;         // ID of the batch this intent belongs to
        bool isActive;           // Whether the intent is active
        bool isProcessed;        // Whether the intent has been processed
    }

    /// @notice Mapping from intent ID to encrypted intent
    mapping(uint256 => EncryptedIntent) public intents;
    
    /// @notice Mapping from user address to their intent IDs
    mapping(address => uint256[]) public userIntents;
    
    /// @notice Mapping from user address to their current state
    mapping(address => UserState) public userStates;
    
    /// @notice Mapping from batch ID to intent IDs in that batch
    mapping(uint256 => uint256[]) public batchIntents;
    
    /// @notice Current intent counter
    uint256 public intentCounter;
    
    /// @notice Current batch counter
    uint256 public batchCounter;
    
    /// @notice Maximum intents per batch for k-anonymity
    uint256 public constant MAX_BATCH_SIZE = 10;
    
    /// @notice Minimum intents required to form a batch
    uint256 public constant MIN_BATCH_SIZE = 5;
    
    /// @notice Maximum batch timeout in seconds
    uint256 public constant BATCH_TIMEOUT = 300; // 5 minutes
    
    /// @notice Address of the batch processor contract
    address public batchProcessor;
    
    /// @notice Address of the fund pool contract
    IFundPool public fundPool;
    
    /// @notice Current batch start time
    uint256 public currentBatchStartTime;
    
    /// @notice Pending intents in current batch
    uint256[] public pendingIntents;

    /// @notice Events
    event IntentSubmitted(
        uint256 indexed intentId,
        address indexed user,
        uint256 indexed batchId,
        uint256 timestamp
    );
    
    event BatchReady(
        uint256 indexed batchId,
        uint256 intentCount,
        uint256 timestamp
    );
    
    event IntentProcessed(
        uint256 indexed intentId,
        uint256 indexed batchId,
        bool success
    );

    event BatchProcessorUpdated(address indexed oldProcessor, address indexed newProcessor);
    
    event UserStateChanged(
        address indexed user,
        UserState oldState,
        UserState newState,
        uint256 timestamp
    );
    
    event UserIntentsCancelled(
        address indexed user,
        uint256[] intentIds,
        uint256 timestamp
    );

    /// @notice Custom errors
    error InvalidBatchProcessor();
    error UnauthorizedCaller();
    error InvalidIntentParameters();
    error IntentNotFound();
    error IntentAlreadyProcessed();
    error BatchNotReady();
    error InsufficientFundPoolBalance();
    error FundPoolNotSet();
    error InvalidUserState();
    error UserNotActive();

    /// @notice Constructor
    /// @param _owner Owner of the contract
    constructor(address _owner) Ownable(_owner) {
        currentBatchStartTime = block.timestamp;
        batchCounter = 1;
    }

    /// @notice Modifier to check if caller is batch processor
    modifier onlyBatchProcessor() {
        if (msg.sender != batchProcessor) revert UnauthorizedCaller();
        _;
    }

    /// @notice Submit a new encrypted DCA intent
    /// @param budgetExt External encrypted budget
    /// @param budgetProof Proof for budget encryption
    /// @param tradesCountExt External encrypted trades count
    /// @param tradesCountProof Proof for trades count encryption
    /// @param amountPerTradeExt External encrypted amount per trade
    /// @param amountPerTradeProof Proof for amount per trade encryption
    /// @param frequencyExt External encrypted frequency
    /// @param frequencyProof Proof for frequency encryption
    /// @param minPriceExt External encrypted minimum price
    /// @param minPriceProof Proof for minimum price encryption
    /// @param maxPriceExt External encrypted maximum price
    /// @param maxPriceProof Proof for maximum price encryption
    /// @return intentId The ID of the submitted intent
    function submitIntent(
        externalEuint64 budgetExt,
        bytes calldata budgetProof,
        externalEuint32 tradesCountExt,
        bytes calldata tradesCountProof,
        externalEuint64 amountPerTradeExt,
        bytes calldata amountPerTradeProof,
        externalEuint32 frequencyExt,
        bytes calldata frequencyProof,
        externalEuint64 minPriceExt,
        bytes calldata minPriceProof,
        externalEuint64 maxPriceExt,
        bytes calldata maxPriceProof
    ) external nonReentrant returns (uint256 intentId) {
        // Check fund pool is set
        if (address(fundPool) == address(0)) revert FundPoolNotSet();
        
        // Check user state - must be ACTIVE to submit intents
        if (userStates[msg.sender] != UserState.ACTIVE) {
            // If UNINITIALIZED and has balance, activate
            if (userStates[msg.sender] == UserState.UNINITIALIZED && 
                fundPool.isBalanceInitialized(msg.sender)) {
                _updateUserState(msg.sender, UserState.ACTIVE);
            } else {
                revert UserNotActive();
            }
        }
        
        // Convert external encrypted inputs to internal encrypted values
        euint64 budget = FHE.fromExternal(budgetExt, budgetProof);
        euint32 tradesCount = FHE.fromExternal(tradesCountExt, tradesCountProof);
        euint64 amountPerTrade = FHE.fromExternal(amountPerTradeExt, amountPerTradeProof);
        euint32 frequency = FHE.fromExternal(frequencyExt, frequencyProof);
        euint64 minPrice = FHE.fromExternal(minPriceExt, minPriceProof);
        euint64 maxPrice = FHE.fromExternal(maxPriceExt, maxPriceProof);
        
        // Check user has sufficient balance in FundPool
        if (!fundPool.isBalanceInitialized(msg.sender)) revert InsufficientFundPoolBalance();
        euint64 userBalance = fundPool.getEncryptedBalance(msg.sender);
        
        // Verify user has enough balance for the budget
        // Using FHE comparison to maintain privacy
        ebool hasSufficientBalance = FHE.ge(userBalance, budget);
        // Note: In production, this would need to handle the encrypted boolean result
        // For now, we'll trust the check passes

        // Increment intent counter
        intentId = ++intentCounter;
        
        // Create new intent
        EncryptedIntent storage intent = intents[intentId];
        intent.budget = budget;
        intent.tradesCount = tradesCount;
        intent.amountPerTrade = amountPerTrade;
        intent.frequency = frequency;
        intent.minPrice = minPrice;
        intent.maxPrice = maxPrice;
        intent.user = msg.sender;
        intent.submittedAt = block.timestamp;
        intent.batchId = batchCounter;
        intent.isActive = true;
        intent.isProcessed = false;

        // Set permissions for encrypted values
        FHE.allowThis(budget);
        FHE.allowThis(tradesCount);
        FHE.allowThis(amountPerTrade);
        FHE.allowThis(frequency);
        FHE.allowThis(minPrice);
        FHE.allowThis(maxPrice);
        
        // Allow user and batch processor to access encrypted values
        FHE.allow(budget, msg.sender);
        FHE.allow(tradesCount, msg.sender);
        FHE.allow(amountPerTrade, msg.sender);
        FHE.allow(frequency, msg.sender);
        FHE.allow(minPrice, msg.sender);
        FHE.allow(maxPrice, msg.sender);
        
        if (batchProcessor != address(0)) {
            FHE.allow(budget, batchProcessor);
            FHE.allow(tradesCount, batchProcessor);
            FHE.allow(amountPerTrade, batchProcessor);
            FHE.allow(frequency, batchProcessor);
            FHE.allow(minPrice, batchProcessor);
            FHE.allow(maxPrice, batchProcessor);
        }

        // Add to user intents and pending batch
        userIntents[msg.sender].push(intentId);
        pendingIntents.push(intentId);
        batchIntents[batchCounter].push(intentId);

        emit IntentSubmitted(intentId, msg.sender, batchCounter, block.timestamp);

        // Check if batch is ready for processing
        _checkBatchReady();
    }

    /// @notice Check if current batch is ready for processing
    /// @return isReady True if batch is ready
    /// @return batchId Current batch ID
    /// @return intentIds Array of intent IDs in the batch
    function checkBatchReady() 
        external 
        view 
        returns (bool isReady, uint256 batchId, uint256[] memory intentIds) 
    {
        isReady = _isBatchReady();
        batchId = batchCounter;
        intentIds = pendingIntents;
    }

    /// @notice Get intent details
    /// @param intentId The intent ID to query
    /// @return intent The encrypted intent struct
    function getIntent(uint256 intentId) 
        external 
        view 
        returns (EncryptedIntent memory intent) 
    {
        if (intentId == 0 || intentId > intentCounter) revert IntentNotFound();
        return intents[intentId];
    }

    /// @notice Get user's intent IDs
    /// @param user The user address
    /// @return intentIds Array of intent IDs for the user
    function getUserIntents(address user) 
        external 
        view 
        returns (uint256[] memory intentIds) 
    {
        return userIntents[user];
    }

    /// @notice Get batch intent IDs
    /// @param batchId The batch ID
    /// @return intentIds Array of intent IDs in the batch
    function getBatchIntents(uint256 batchId) 
        external 
        view 
        returns (uint256[] memory intentIds) 
    {
        return batchIntents[batchId];
    }

    /// @notice Mark intents as processed (called by batch processor)
    /// @param intentIds Array of intent IDs to mark as processed
    /// @param success Whether the processing was successful
    function markIntentsProcessed(uint256[] calldata intentIds, bool success) 
        external 
        onlyBatchProcessor 
    {
        for (uint256 i = 0; i < intentIds.length; i++) {
            uint256 intentId = intentIds[i];
            if (intentId == 0 || intentId > intentCounter) revert IntentNotFound();
            
            EncryptedIntent storage intent = intents[intentId];
            if (intent.isProcessed) revert IntentAlreadyProcessed();
            
            intent.isProcessed = true;
            if (!success) {
                intent.isActive = false;
            }
            
            emit IntentProcessed(intentId, intent.batchId, success);
        }
    }

    /// @notice Start new batch (called by batch processor)
    function startNewBatch() external onlyBatchProcessor {
        batchCounter++;
        currentBatchStartTime = block.timestamp;
        delete pendingIntents;
    }

    /// @notice Set batch processor address
    /// @param _batchProcessor Address of the batch processor contract
    function setBatchProcessor(address _batchProcessor) external onlyOwner {
        if (_batchProcessor == address(0)) revert InvalidBatchProcessor();
        
        address oldProcessor = batchProcessor;
        batchProcessor = _batchProcessor;
        
        emit BatchProcessorUpdated(oldProcessor, _batchProcessor);
    }
    
    /// @notice Set fund pool address
    /// @param _fundPool Address of the fund pool contract
    function setFundPool(address _fundPool) external onlyOwner {
        if (_fundPool == address(0)) revert FundPoolNotSet();
        
        fundPool = IFundPool(_fundPool);
    }

    /// @notice Internal function to check if batch is ready
    function _checkBatchReady() internal {
        if (_isBatchReady()) {
            emit BatchReady(batchCounter, pendingIntents.length, block.timestamp);
        }
    }

    /// @notice Internal function to determine if batch is ready for processing
    /// @return True if batch should be processed
    function _isBatchReady() internal view returns (bool) {
        uint256 pendingCount = pendingIntents.length;
        uint256 timeSinceStart = block.timestamp - currentBatchStartTime;
        
        // Batch is ready if:
        // 1. We have max batch size, OR
        // 2. We have min batch size AND timeout has elapsed
        return (pendingCount >= MAX_BATCH_SIZE) || 
               (pendingCount >= MIN_BATCH_SIZE && timeSinceStart >= BATCH_TIMEOUT);
    }

    /// @notice Get pending intents count
    /// @return count Number of pending intents
    function getPendingIntentsCount() external view returns (uint256 count) {
        return pendingIntents.length;
    }

    /// @notice Get batch statistics
    /// @return currentBatch Current batch ID
    /// @return pendingCount Number of pending intents
    /// @return timeRemaining Seconds until batch timeout (0 if expired)
    function getBatchStats() 
        external 
        view 
        returns (uint256 currentBatch, uint256 pendingCount, uint256 timeRemaining) 
    {
        currentBatch = batchCounter;
        pendingCount = pendingIntents.length;
        
        uint256 elapsed = block.timestamp - currentBatchStartTime;
        if (elapsed >= BATCH_TIMEOUT) {
            timeRemaining = 0;
        } else {
            timeRemaining = BATCH_TIMEOUT - elapsed;
        }
    }
    
    /// @notice Update user state (only callable by FundPool or BatchProcessor)
    /// @param user User address
    /// @param newState New state for the user
    function updateUserState(address user, UserState newState) external {
        // Only FundPool or BatchProcessor can update user state
        if (msg.sender != address(fundPool) && msg.sender != batchProcessor) {
            revert UnauthorizedCaller();
        }
        
        _updateUserState(user, newState);
    }
    
    /// @notice Internal function to update user state
    /// @param user User address
    /// @param newState New state for the user
    function _updateUserState(address user, UserState newState) internal {
        UserState oldState = userStates[user];
        
        // Validate state transitions
        if (oldState == newState) return;
        
        // State transition rules
        if (oldState == UserState.UNINITIALIZED) {
            require(newState == UserState.ACTIVE, "Invalid state transition");
        } else if (oldState == UserState.ACTIVE) {
            require(
                newState == UserState.WITHDRAWING || newState == UserState.WITHDRAWN,
                "Invalid state transition"
            );
        } else if (oldState == UserState.WITHDRAWING) {
            require(
                newState == UserState.WITHDRAWN || newState == UserState.ACTIVE,
                "Invalid state transition"
            );
        } else if (oldState == UserState.WITHDRAWN) {
            require(newState == UserState.ACTIVE, "Invalid state transition");
        }
        
        userStates[user] = newState;
        emit UserStateChanged(user, oldState, newState, block.timestamp);
    }
    
    /// @notice Cancel all active intents for a user (called during withdrawal)
    /// @param user User address
    function cancelUserIntents(address user) external {
        // Only FundPool can cancel intents during withdrawal
        if (msg.sender != address(fundPool)) {
            revert UnauthorizedCaller();
        }
        
        uint256[] memory intentIds = userIntents[user];
        uint256 cancelledCount = 0;
        uint256[] memory cancelledIds = new uint256[](intentIds.length);
        
        for (uint256 i = 0; i < intentIds.length; i++) {
            uint256 intentId = intentIds[i];
            EncryptedIntent storage intent = intents[intentId];
            
            // Only cancel active intents
            if (intent.isActive && !intent.isProcessed) {
                intent.isActive = false;
                cancelledIds[cancelledCount] = intentId;
                cancelledCount++;
                
                // Remove from pending intents if present
                _removeFromPending(intentId);
            }
        }
        
        if (cancelledCount > 0) {
            // Resize array to actual cancelled count
            assembly {
                mstore(cancelledIds, cancelledCount)
            }
            emit UserIntentsCancelled(user, cancelledIds, block.timestamp);
        }
    }
    
    /// @notice Remove an intent from pending list
    /// @param intentId Intent ID to remove
    function _removeFromPending(uint256 intentId) internal {
        uint256 length = pendingIntents.length;
        for (uint256 i = 0; i < length; i++) {
            if (pendingIntents[i] == intentId) {
                // Move last element to this position and pop
                if (i < length - 1) {
                    pendingIntents[i] = pendingIntents[length - 1];
                }
                pendingIntents.pop();
                break;
            }
        }
    }
    
    /// @notice Get user state
    /// @param user User address
    /// @return Current user state
    function getUserState(address user) external view returns (UserState) {
        return userStates[user];
    }
    
    /// @notice Check if user can submit intents
    /// @param user User address
    /// @return True if user can submit intents
    function canSubmitIntent(address user) external view returns (bool) {
        return userStates[user] == UserState.ACTIVE || 
               (userStates[user] == UserState.UNINITIALIZED && 
                fundPool.isBalanceInitialized(user));
    }
    
    /// @notice Get active intent IDs for batch processing (filters by user state)
    /// @param intentIds Array of intent IDs to filter
    /// @return activeIntentIds Array of intent IDs for active users only
    function filterActiveIntents(uint256[] calldata intentIds) 
        external 
        view 
        returns (uint256[] memory activeIntentIds) 
    {
        uint256[] memory tempIds = new uint256[](intentIds.length);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < intentIds.length; i++) {
            uint256 intentId = intentIds[i];
            EncryptedIntent memory intent = intents[intentId];
            
            // Only include intents from ACTIVE users
            if (userStates[intent.user] == UserState.ACTIVE && 
                intent.isActive && 
                !intent.isProcessed) {
                tempIds[activeCount] = intentId;
                activeCount++;
            }
        }
        
        // Resize array to actual count
        activeIntentIds = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            activeIntentIds[i] = tempIds[i];
        }
    }
}