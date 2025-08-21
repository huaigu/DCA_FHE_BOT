const { ethers } = require("ethers");

// Known potential USDC addresses on Sepolia (these are common testnet addresses)
const POTENTIAL_USDC_ADDRESSES = [
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle's USDC
  "0x07865c6E87B9F70255377e024ace6630C1Eaa37F", // Another common USDC testnet address
  "0x2f3A40A3db8a7e3dD15B1e86aC6c6E0d7E8d4F9e", // Possible USDC address
  "0x6f14C02Fc1F78322cFd7d707aB90f18baD3B54f5", // Another possibility
  "0x5425890298aed601595a70AB815c96711a31Bc65", // USDC on some testnets
];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)"
];

async function main() {
  console.log("🔍 Searching for USDC contracts on Sepolia");
  
  const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/126e2978c6db47b7b116c07e4ba787e9");
  
  for (const address of POTENTIAL_USDC_ADDRESSES) {
    try {
      console.log(`\n🔍 Checking ${address}...`);
      
      const code = await provider.getCode(address);
      if (code === "0x") {
        console.log("❌ No contract deployed");
        continue;
      }
      
      const contract = new ethers.Contract(address, ERC20_ABI, provider);
      
      const name = await contract.name();
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      const totalSupply = await contract.totalSupply();
      
      console.log(`✅ Contract found!`);
      console.log(`   Name: ${name}`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Decimals: ${decimals}`);
      console.log(`   Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`);
      
      if (symbol === "USDC" || name.includes("USDC") || name.includes("USD Coin")) {
        console.log("🎯 This looks like a USDC contract!");
      }
      
    } catch (error) {
      console.log(`❌ Error checking contract: ${error.message}`);
    }
  }
  
  // Also check the current configured addresses
  console.log("\n🔍 Checking currently configured addresses:");
  
  const configuredAddresses = [
    { name: "Frontend USDC", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
    { name: "FundPool USDC", address: "0xa0b86A33E6417c8f6C89c35239E6C5B5E6b3d5F7" }
  ];
  
  for (const {name, address} of configuredAddresses) {
    try {
      console.log(`\n🔍 Checking ${name}: ${address}...`);
      
      const code = await provider.getCode(address);
      if (code === "0x") {
        console.log("❌ No contract deployed");
        continue;
      }
      
      const contract = new ethers.Contract(address, ERC20_ABI, provider);
      const symbol = await contract.symbol();
      const name_result = await contract.name();
      
      console.log(`✅ Contract found: ${name_result} (${symbol})`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

main().catch(console.error);