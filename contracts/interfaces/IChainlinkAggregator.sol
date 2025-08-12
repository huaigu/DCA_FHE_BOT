// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Chainlink Aggregator Interface
/// @notice Interface for Chainlink price feed aggregators
/// @dev Used to get current price data from Chainlink oracles
interface IChainlinkAggregator {
    /// @notice Returns the latest round data from the price feed
    /// @return roundId The round ID of the latest update
    /// @return answer The latest price answer
    /// @return startedAt Timestamp when the round started
    /// @return updatedAt Timestamp when the round was last updated
    /// @return answeredInRound The round ID in which the answer was computed
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    /// @notice Returns the number of decimals for the price feed
    /// @return The number of decimals
    function decimals() external view returns (uint8);

    /// @notice Returns the description of the price feed
    /// @return The description string
    function description() external view returns (string memory);

    /// @notice Returns the version of the aggregator
    /// @return The version number
    function version() external view returns (uint256);

    /// @notice Returns data from a specific round
    /// @param roundId The round ID to query
    /// @return roundId The round ID
    /// @return answer The price answer for that round
    /// @return startedAt Timestamp when the round started
    /// @return updatedAt Timestamp when the round was updated
    /// @return answeredInRound The round ID in which the answer was computed
    function getRoundData(uint80 roundId)
        external
        view
        returns (
            uint80,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}