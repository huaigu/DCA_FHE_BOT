// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IWithdrawalGateway} from "../interfaces/IWithdrawalGateway.sol";

/// @title MockWithdrawalGateway
/// @notice Mock implementation of IWithdrawalGateway for testing
contract MockWithdrawalGateway is IWithdrawalGateway {
    struct DecryptionRequest {
        euint64 encryptedValue;
        address requester;
        uint256 decryptedValue;
        bool ready;
        bool cancelled;
    }
    
    mapping(uint256 => DecryptionRequest) public requests;
    uint256 public nextRequestId = 1;
    
    // For testing: allow setting decryption results
    mapping(address => uint256) public mockBalances;
    
    /// @notice Set mock balance for a user (for testing)
    function setMockBalance(address user, uint256 balance) external {
        mockBalances[user] = balance;
    }
    
    /// @notice Request decryption of an encrypted value
    function requestDecryption(
        euint64 encryptedValue,
        address requester
    ) external override returns (uint256 requestId) {
        requestId = nextRequestId++;
        
        requests[requestId] = DecryptionRequest({
            encryptedValue: encryptedValue,
            requester: requester,
            decryptedValue: mockBalances[requester], // Use mock balance
            ready: false,
            cancelled: false
        });
        
        return requestId;
    }
    
    /// @notice Simulate gateway callback (for testing)
    function simulateFulfillment(uint256 requestId, address targetContract) external {
        DecryptionRequest storage request = requests[requestId];
        require(!request.cancelled, "Request cancelled");
        require(!request.ready, "Already fulfilled");
        
        request.ready = true;
        
        // Call the fulfillWithdrawal function on the target contract
        (bool success,) = targetContract.call(
            abi.encodeWithSignature(
                "fulfillWithdrawal(uint256,uint256)",
                requestId,
                request.decryptedValue
            )
        );
        require(success, "Fulfillment failed");
    }
    
    /// @notice Callback function (not used in mock)
    function fulfillDecryption(
        uint256 requestId,
        uint256 decryptedValue
    ) external override {
        DecryptionRequest storage request = requests[requestId];
        request.decryptedValue = decryptedValue;
        request.ready = true;
    }
    
    /// @notice Check if a decryption request is ready
    function getDecryptionResult(
        uint256 requestId
    ) external view override returns (bool ready, uint256 value) {
        DecryptionRequest storage request = requests[requestId];
        return (request.ready, request.decryptedValue);
    }
    
    /// @notice Cancel a pending decryption request
    function cancelDecryption(uint256 requestId) external override {
        DecryptionRequest storage request = requests[requestId];
        require(!request.ready, "Already fulfilled");
        request.cancelled = true;
    }
}