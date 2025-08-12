// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IUniswapV3Router.sol";

/// @title MockUniswapRouter
/// @notice Mock Uniswap V3 router for testing
contract MockUniswapRouter {
    uint256 public swapResult;
    
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor() {
        swapResult = 1 ether; // Default return 1 ETH
    }

    function setSwapResult(uint256 _swapResult) external {
        swapResult = _swapResult;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        // Transfer tokens from sender (simulate real swap)
        if (params.tokenIn != address(0)) {
            IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        }

        // Return mock swap result
        amountOut = swapResult;

        // Transfer output tokens to recipient (simulate ETH/WETH)
        if (params.tokenOut != address(0)) {
            // For WETH or other ERC20
            IERC20(params.tokenOut).transfer(params.recipient, amountOut);
        } else {
            // For ETH
            (bool success, ) = params.recipient.call{value: amountOut}("");
            require(success, "ETH transfer failed");
        }

        emit SwapExecuted(params.tokenIn, params.tokenOut, params.amountIn, amountOut);
    }

    function exactInput(ExactInputParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        // Simplified implementation - just return swap result
        amountOut = swapResult;
        
        // For multi-hop swaps, we'd need to decode the path
        // For testing, we'll just return the mock result
    }

    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external view returns (uint256 amountOut) {
        // Return a quote based on the mock swap result
        // In real implementation, this would calculate based on pool state
        amountOut = swapResult;
    }

    // Allow contract to receive ETH
    receive() external payable {}
}