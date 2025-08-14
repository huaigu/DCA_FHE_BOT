// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title IWithdrawalGateway
/// @notice Interface for the Zama Gateway service that handles FHE decryption for withdrawals
interface IWithdrawalGateway {
    /// @notice Request decryption of an encrypted value
    /// @param encryptedValue The encrypted value to decrypt
    /// @param requester The address requesting decryption
    /// @return requestId The ID of the decryption request
    function requestDecryption(
        euint64 encryptedValue,
        address requester
    ) external returns (uint256 requestId);
    
    /// @notice Callback function called by the gateway with decryption result
    /// @param requestId The ID of the decryption request
    /// @param decryptedValue The decrypted value
    function fulfillDecryption(
        uint256 requestId,
        uint256 decryptedValue
    ) external;
    
    /// @notice Check if a decryption request is ready
    /// @param requestId The ID of the decryption request
    /// @return ready Whether the decryption is complete
    /// @return value The decrypted value (0 if not ready)
    function getDecryptionResult(
        uint256 requestId
    ) external view returns (bool ready, uint256 value);
    
    /// @notice Cancel a pending decryption request
    /// @param requestId The ID of the decryption request to cancel
    function cancelDecryption(uint256 requestId) external;
}