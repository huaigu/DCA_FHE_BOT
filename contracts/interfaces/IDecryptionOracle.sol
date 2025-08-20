// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDecryptionOracle
/// @notice Interface for Zama's decryption oracle service
/// @dev Based on https://docs.zama.ai/protocol/solidity-guides/smart-contract/oracle
interface IDecryptionOracle {
    /// @notice Request decryption of encrypted values
    /// @param ctsHandles Array of ciphertext handles to decrypt
    /// @param callbackSelector Function selector for callback
    /// @return requestId Unique identifier for this decryption request
    function requestDecryption(
        bytes32[] calldata ctsHandles,
        bytes4 callbackSelector
    ) external payable returns (uint256 requestId);

    /// @notice Cancel a pending decryption request
    /// @param requestId The request ID to cancel
    function cancelDecryption(uint256 requestId) external;

    /// @notice Get the status of a decryption request
    /// @param requestId The request ID to check
    /// @return isPending Whether the request is still pending
    /// @return isCompleted Whether the request has been completed
    function getDecryptionStatus(uint256 requestId) 
        external 
        view 
        returns (bool isPending, bool isCompleted);

    /// @notice Get the required fee for decryption
    /// @param numValues Number of values to decrypt
    /// @return fee The fee amount in wei
    function getDecryptionFee(uint256 numValues) 
        external 
        view 
        returns (uint256 fee);

    /// @notice Event emitted when decryption is requested
    event DecryptionRequested(
        uint256 indexed requestId,
        address indexed requester,
        bytes32[] ctsHandles,
        bytes4 callbackSelector
    );

    /// @notice Event emitted when decryption is completed
    event DecryptionCompleted(
        uint256 indexed requestId,
        bool success
    );

    /// @notice Event emitted when decryption is cancelled
    event DecryptionCancelled(
        uint256 indexed requestId
    );
}