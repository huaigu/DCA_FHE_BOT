// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDecryptionOracle} from "../interfaces/IDecryptionOracle.sol";

/// @title MockDecryptionOracle
/// @notice Mock implementation of the decryption oracle for testing
/// @dev This simulates Zama's decryption service for development and testing
contract MockDecryptionOracle is IDecryptionOracle {
    struct DecryptionRequest {
        address requester;
        bytes32[] ctsHandles;
        bytes4 callbackSelector;
        uint256 timestamp;
        bool completed;
        bool cancelled;
    }
    
    mapping(uint256 => DecryptionRequest) public requests;
    uint256 public nextRequestId;
    uint256 public constant BASE_FEE = 0.01 ether;
    
    /// @notice Mapping to store mock decrypted values for testing
    mapping(bytes32 => uint256) public mockDecryptedValues;
    
    constructor() {
        nextRequestId = 1;
    }
    
    /// @notice Request decryption of encrypted values
    /// @param ctsHandles Array of ciphertext handles to decrypt
    /// @param callbackSelector Function selector for callback
    /// @return requestId Unique identifier for this decryption request
    function requestDecryption(
        bytes32[] calldata ctsHandles,
        bytes4 callbackSelector
    ) external payable override returns (uint256 requestId) {
        require(msg.value >= getDecryptionFee(ctsHandles.length), "Insufficient fee");
        
        requestId = nextRequestId++;
        
        requests[requestId] = DecryptionRequest({
            requester: msg.sender,
            ctsHandles: ctsHandles,
            callbackSelector: callbackSelector,
            timestamp: block.timestamp,
            completed: false,
            cancelled: false
        });
        
        emit DecryptionRequested(requestId, msg.sender, ctsHandles, callbackSelector);
        
        // Auto-fulfill in next block for testing
        // In production, this would be handled by an external oracle service
    }
    
    /// @notice Mock function to fulfill decryption request (for testing)
    /// @param requestId The request ID to fulfill
    /// @param decryptedValues The decrypted values
    function mockFulfillDecryption(
        uint256 requestId,
        uint256[] calldata decryptedValues
    ) external {
        DecryptionRequest storage request = requests[requestId];
        require(!request.completed, "Already completed");
        require(!request.cancelled, "Request cancelled");
        
        request.completed = true;
        
        // Call the callback function on the requester contract
        (bool success, ) = request.requester.call(
            abi.encodeWithSelector(
                request.callbackSelector,
                requestId,
                decryptedValues
            )
        );
        
        emit DecryptionCompleted(requestId, success);
    }
    
    /// @notice Auto-fulfill with mock data (for testing convenience)
    /// @param requestId The request ID to auto-fulfill
    /// @param mockAmounts Mock amounts to use for each handle
    function autoFulfillWithMockData(
        uint256 requestId,
        uint256[] calldata mockAmounts
    ) external {
        DecryptionRequest storage request = requests[requestId];
        require(!request.completed, "Already completed");
        require(mockAmounts.length == request.ctsHandles.length, "Length mismatch");
        
        request.completed = true;
        
        // Store mock values
        for (uint256 i = 0; i < request.ctsHandles.length; i++) {
            mockDecryptedValues[request.ctsHandles[i]] = mockAmounts[i];
        }
        
        // Call the callback
        (bool success, ) = request.requester.call(
            abi.encodeWithSelector(
                request.callbackSelector,
                requestId,
                mockAmounts
            )
        );
        
        emit DecryptionCompleted(requestId, success);
    }
    
    /// @notice Cancel a pending decryption request
    /// @param requestId The request ID to cancel
    function cancelDecryption(uint256 requestId) external override {
        DecryptionRequest storage request = requests[requestId];
        require(msg.sender == request.requester, "Not requester");
        require(!request.completed, "Already completed");
        require(!request.cancelled, "Already cancelled");
        
        request.cancelled = true;
        
        // Refund the fee
        payable(msg.sender).transfer(BASE_FEE);
        
        emit DecryptionCancelled(requestId);
    }
    
    /// @notice Get the status of a decryption request
    /// @param requestId The request ID to check
    /// @return isPending Whether the request is still pending
    /// @return isCompleted Whether the request has been completed
    function getDecryptionStatus(uint256 requestId) 
        external 
        view 
        override 
        returns (bool isPending, bool isCompleted) 
    {
        DecryptionRequest storage request = requests[requestId];
        isPending = !request.completed && !request.cancelled;
        isCompleted = request.completed;
    }
    
    /// @notice Get the required fee for decryption
    /// @param numValues Number of values to decrypt
    /// @return fee The fee amount in wei
    function getDecryptionFee(uint256 numValues) 
        public 
        pure 
        override 
        returns (uint256 fee) 
    {
        fee = BASE_FEE * numValues;
    }
    
    /// @notice Set mock decrypted value for a handle (testing only)
    /// @param handle The ciphertext handle
    /// @param value The mock decrypted value
    function setMockDecryptedValue(bytes32 handle, uint256 value) external {
        mockDecryptedValues[handle] = value;
    }
    
    /// @notice Get mock decrypted value for a handle (testing only)
    /// @param handle The ciphertext handle
    /// @return The mock decrypted value
    function getMockDecryptedValue(bytes32 handle) external view returns (uint256) {
        return mockDecryptedValues[handle];
    }
}