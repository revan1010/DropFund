const { ethers, network } = require("hardhat");

async function main() {
  console.log("Deploying contracts to", network.name);
  
  let usdcAddress;
  
  if (network.name === "fuji") {
    // Use existing USDC on Fuji testnet
    usdcAddress = "0x5425890298aed601595a70AB815c96711a31Bc65"; // USDC on Fuji testnet
    console.log("Using existing USDC on Fuji at:", usdcAddress);
  } else {
    // Deploy MockUSDC for local testing
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    
    usdcAddress = await mockUSDC.getAddress();
    console.log("MockUSDC deployed to:", usdcAddress);
  }
  
  // Deploy BulkDonation with USDC address
  const BulkDonation = await ethers.getContractFactory("BulkDonation");
  const bulkDonation = await BulkDonation.deploy(usdcAddress);
  await bulkDonation.waitForDeployment();
  
  const bulkDonationAddress = await bulkDonation.getAddress();
  console.log("BulkDonation deployed to:", bulkDonationAddress);
  
  console.log("Deployment completed successfully");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 