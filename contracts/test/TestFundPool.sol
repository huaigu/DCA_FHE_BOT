// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {FundPool} from "../FundPool.sol";

/// @title TestFundPool
/// @notice Test version of FundPool with additional test-only functions
/// @dev Inherits from production FundPool and adds test utilities
contract TestFundPool is FundPool {
    constructor(address _usdcToken, address _owner) FundPool(_usdcToken, _owner) {}
    
    /// @notice Test function to initialize user balance (only for testing)
    /// @dev This should only be used in test environments
    function testInitializeBalance(address user, uint256 amount) external onlyOwner {
        if (!isBalanceInitialized[user]) {
            _initializeBalance(user);
        }
        
        // Set balance directly for testing
        euint64 encryptedAmount = FHE.asEuint64(uint64(amount));
        encryptedBalances[user] = encryptedAmount;
        
        // Set permissions - ensure all relevant contracts have access
        FHE.allowThis(encryptedAmount);
        FHE.allow(encryptedAmount, user);
        FHE.allow(encryptedAmount, address(this)); // Allow FundPool itself
        if (batchProcessor != address(0)) {
            FHE.allow(encryptedAmount, batchProcessor);
        }
        if (intentCollector != address(0)) {
            FHE.allow(encryptedAmount, intentCollector);
        }
    }
}