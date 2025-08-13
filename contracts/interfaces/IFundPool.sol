// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title IFundPool
/// @notice Interface for the FundPool contract that manages encrypted user balances
interface IFundPool {
    /// @notice Deposit USDC and record encrypted balance
    /// @param amountExt Encrypted amount to deposit
    /// @param amountProof Proof for the encrypted amount
    /// @param plaintextAmount The plaintext amount for USDC transfer (temporary solution for testing)
    function deposit(externalEuint64 amountExt, bytes calldata amountProof, uint256 plaintextAmount) external;
    
    /// @notice Withdraw USDC from encrypted balance
    /// @param amount Plain amount to withdraw (must match encrypted balance)
    /// @param proof Proof that amount matches encrypted balance
    function withdraw(uint256 amount, bytes calldata proof) external;
    
    /// @notice Get encrypted balance for a user
    /// @param user The user address
    /// @return The encrypted balance
    function getEncryptedBalance(address user) external view returns (euint64);
    
    /// @notice Deduct encrypted amount from user's balance (only callable by BatchProcessor)
    /// @param user The user address
    /// @param amount The encrypted amount to deduct
    /// @return success Whether the deduction was successful
    function deductBalance(address user, euint64 amount) external returns (bool success);
    
    /// @notice Transfer aggregated USDC to BatchProcessor for swap
    /// @param amount The amount to transfer
    function transferToBatchProcessor(uint256 amount) external;
    
    /// @notice Check if user has initialized their encrypted balance
    /// @param user The user address
    /// @return Whether the balance is initialized
    function isBalanceInitialized(address user) external view returns (bool);
    
    /// @notice Get the total USDC balance held by the pool
    /// @return The total balance
    function getTotalPoolBalance() external view returns (uint256);
}