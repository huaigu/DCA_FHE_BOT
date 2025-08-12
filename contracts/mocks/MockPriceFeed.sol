// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockPriceFeed
/// @notice Mock Chainlink price feed for testing
contract MockPriceFeed {
    uint80 public roundId;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80 public answeredInRound;
    uint8 public decimals = 8;
    string public description = "ETH / USD";
    uint256 public version = 1;

    constructor() {
        // Initialize with default values
        roundId = 1;
        answer = 200000000000; // $2000 with 8 decimals
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        answeredInRound = 1;
    }

    function setLatestRoundData(
        uint80 _roundId,
        int256 _answer,
        uint256 _startedAt,
        uint256 _updatedAt,
        uint80 _answeredInRound
    ) external {
        roundId = _roundId;
        answer = _answer;
        startedAt = _startedAt;
        updatedAt = _updatedAt;
        answeredInRound = _answeredInRound;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }

    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        // For simplicity, return the latest data regardless of roundId
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}