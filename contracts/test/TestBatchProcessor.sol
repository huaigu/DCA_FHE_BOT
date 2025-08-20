// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {BatchProcessor} from "../BatchProcessor.sol";

/// @title TestBatchProcessor  
/// @notice Test version of BatchProcessor with mock decryption capabilities
/// @dev Inherits from production BatchProcessor and adds test utilities
contract TestBatchProcessor is BatchProcessor {
    /// @notice Structure for tracking user contributions in a batch (with test fields)
    struct TestUserContribution {
        address user;
        euint64 encryptedAmount;
        uint256 plaintextAmount;  // For testing only
    }
    
    /// @notice Track test contributions for each batch
    mapping(uint256 => TestUserContribution[]) public testBatchContributions;
    
    constructor(
        address _intentCollector,
        address _priceFeed,
        address _uniswapRouter,
        address _usdcToken,
        address _wethAddress,
        address _owner
    ) BatchProcessor(_intentCollector, _priceFeed, _uniswapRouter, _usdcToken, _wethAddress, _owner) {}
    
    /// @notice Process batch with mock decryption (for testing)
    /// @param batchId The batch ID
    /// @param intentIds All intent IDs
    /// @param validIntentIds Valid intent IDs
    /// @param currentPrice Current ETH price
    function processBatchWithMockDecryption(
        uint256 batchId,
        uint256[] memory intentIds,
        uint256[] memory validIntentIds,
        uint256 currentPrice
    ) external onlyOwner {
        // TEMPORARY: For testing, only set amount if we actually have executing intents
        uint256 decryptedTotalAmount = 0;
        
        if (validIntentIds.length > 0) {
            // Check if any intents actually passed the price filter
            bool anyIntentShouldExecute = _checkIfAnyIntentShouldExecute(validIntentIds, currentPrice);
            if (anyIntentShouldExecute) {
                // For testing, use a reasonable estimate
                decryptedTotalAmount = validIntentIds.length * 100 * 1000000; // 100 USDC per intent
            }
        }
        
        _executeSwapAndDistribute(batchId, intentIds, validIntentIds, decryptedTotalAmount, currentPrice);
    }
    
    /// @notice Test function to bypass decryption oracle requirement
    /// @param batchId The batch ID to process  
    function testManualTriggerBatch(uint256 batchId) external onlyOwner {
        // Get ready batch data
        (uint256 currentBatchId, uint256[] memory intentIds) = intentCollector.getReadyBatch();
        
        if (currentBatchId != batchId) {
            revert("No ready batch matching the provided ID");
        }
        
        if (batchId <= lastProcessedBatch) {
            revert("Batch already processed or invalid");
        }
        
        // Automation triggered for testing
        
        // Get current price
        PriceData memory currentPrice = _getCurrentPrice();
        
        // Filter and aggregate intents with price conditions
        (uint256[] memory validIntentIds, euint64 encryptedTotalAmount) = 
            _filterAndAggregateIntents(intentIds, currentPrice.price);
        
        // If no valid intents, mark batch as processed
        if (validIntentIds.length == 0) {
            _finalizeBatch(batchId, intentIds, true, 0, 0, currentPrice.price, 0);
            return;
        }
        
        // Process batch with mock decryption (test only)
        _processBatchWithMockDecryption(batchId, intentIds, validIntentIds, currentPrice.price);
    }
    
    /// @notice Mock decryption for testing
    function _processBatchWithMockDecryption(
        uint256 batchId,
        uint256[] memory intentIds,
        uint256[] memory validIntentIds,
        uint256 currentPrice
    ) internal {
        // For testing, only set amount if we actually have executing intents
        uint256 decryptedTotalAmount = 0;
        
        if (validIntentIds.length > 0) {
            // Check if any intents actually passed the price filter
            bool anyIntentShouldExecute = _checkIfAnyIntentShouldExecute(validIntentIds, currentPrice);
            if (anyIntentShouldExecute) {
                // For testing, use a reasonable estimate
                decryptedTotalAmount = validIntentIds.length * 100 * 1000000; // 100 USDC per intent
            }
        }
        
        _executeSwapAndDistribute(batchId, intentIds, validIntentIds, decryptedTotalAmount, currentPrice);
    }
}