const { ethers } = require('ethers');

// 生成 checkData 的十六进制字符串
// 格式：abi.encode(minBatchSize, maxPriceAge)
// 数值：(5, 7200)

function generateCheckData() {
    console.log('🔧 生成 Chainlink Automation checkData');
    console.log('参数：minBatchSize = 5, maxPriceAge = 7200');
    
    // 使用 ethers.js 的 ABI 编码功能
    const abiCoder = new ethers.AbiCoder();
    
    // 编码参数：(uint256, uint256)
    const checkData = abiCoder.encode(
        ['uint256', 'uint256'],
        [5, 7200]
    );
    
    console.log('\n📋 结果：');
    console.log('十六进制字符串：', checkData);
    console.log('长度：', checkData.length - 2, 'bytes'); // 减去 '0x' 前缀
    
    // 验证解码
    console.log('\n✅ 验证解码：');
    const decoded = abiCoder.decode(['uint256', 'uint256'], checkData);
    console.log('minBatchSize：', decoded[0].toString());
    console.log('maxPriceAge：', decoded[1].toString());
    
    return checkData;
}

// 执行生成
const result = generateCheckData();

module.exports = { generateCheckData, checkData: result };