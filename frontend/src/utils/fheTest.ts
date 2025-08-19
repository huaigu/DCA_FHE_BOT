import { initializeFHE, encryptAmount } from '@/utils/fheEncryption'

// Simple test function for FHE integration
export async function testFHEIntegration() {
  try {
    console.log('Testing FHE npm package integration...')
    
    // Test 1: Initialize FHE
    const instance = await initializeFHE()
    console.log('✓ FHE initialization successful:', !!instance)
    
    // Test 2: Create encrypted input (mock values)
    const mockContractAddress = '0x1234567890123456789012345678901234567890'
    const mockUserAddress = '0x0987654321098765432109876543210987654321'
    const mockAmount = BigInt(1000000) // 1 USDC (6 decimals)
    
    const encrypted = await encryptAmount(mockAmount, mockContractAddress, mockUserAddress)
    console.log('✓ Encryption successful:', {
      hasEncryptedData: !!encrypted.encryptedData,
      hasProof: !!encrypted.proof,
      encryptedDataLength: encrypted.encryptedData.length,
      proofLength: encrypted.proof.length
    })
    
    return {
      success: true,
      instance,
      encrypted
    }
  } catch (error) {
    console.error('✗ FHE integration test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Export for use in development console
if (typeof window !== 'undefined') {
  (window as any).testFHEIntegration = testFHEIntegration
}