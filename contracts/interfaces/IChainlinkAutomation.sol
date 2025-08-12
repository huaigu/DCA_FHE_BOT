// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Chainlink Automation Interface
/// @notice Interface for Chainlink Automation compatible contracts
/// @dev Contracts implementing this interface can be automated by Chainlink
interface IChainlinkAutomation {
    /// @notice Method called by Chainlink Automation to check if upkeep is needed
    /// @param checkData Data passed to the contract when checking for upkeep
    /// @return upkeepNeeded Boolean indicating if upkeep should be performed
    /// @return performData Data to be passed to performUpkeep function
    function checkUpkeep(bytes calldata checkData)
        external
        view
        returns (bool upkeepNeeded, bytes memory performData);

    /// @notice Method called by Chainlink Automation to perform upkeep
    /// @param performData Data passed from checkUpkeep function
    function performUpkeep(bytes calldata performData) external;
}

/// @title Chainlink Automation Registry Interface
/// @notice Interface for interacting with Chainlink Automation registry
interface IChainlinkAutomationRegistry {
    /// @notice Registers a new upkeep
    /// @param target Target contract address
    /// @param gasLimit Gas limit for upkeep execution
    /// @param admin Admin address for the upkeep
    /// @param checkData Data passed to checkUpkeep
    /// @param offchainConfig Off-chain configuration
    /// @return upkeepId The ID of the registered upkeep
    function registerUpkeep(
        address target,
        uint32 gasLimit,
        address admin,
        bytes calldata checkData,
        bytes calldata offchainConfig
    ) external returns (uint256 upkeepId);

    /// @notice Cancels an upkeep
    /// @param upkeepId The ID of the upkeep to cancel
    function cancelUpkeep(uint256 upkeepId) external;

    /// @notice Adds funds to an upkeep
    /// @param upkeepId The ID of the upkeep
    /// @param amount Amount of LINK to add
    function addFunds(uint256 upkeepId, uint96 amount) external;
}