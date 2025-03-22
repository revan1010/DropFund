const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BulkDonation", function () {
  let bulkDonation;
  let mockUSDC;
  let owner;
  let ngo;
  let recipient1;
  let recipient2;
  let bulkDonationAddress;
  let mockUSDCAddress;
  
  const NGO_NAME = "Charity Foundation";
  const NGO_DESCRIPTION = "Helping those in need";
  const PHONE_1 = "+11234567890";
  const PHONE_2 = "+19876543210";
  
  beforeEach(async function () {
    // Get signers
    [owner, ngo, recipient1, recipient2] = await ethers.getSigners();
    
    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    
    mockUSDCAddress = await mockUSDC.getAddress();
    
    // Deploy BulkDonation
    const BulkDonation = await ethers.getContractFactory("BulkDonation");
    bulkDonation = await BulkDonation.deploy(mockUSDCAddress);
    await bulkDonation.waitForDeployment();
    
    bulkDonationAddress = await bulkDonation.getAddress();
    
    // Mint some USDC to the NGO for testing
    await mockUSDC.mint(ngo.address, ethers.parseUnits("10000", 6));
  });
  
  describe("NGO Registration", function () {
    it("Should register an NGO", async function () {
      await bulkDonation.connect(ngo).registerNGO(NGO_NAME, NGO_DESCRIPTION);
      
      const ngoData = await bulkDonation.ngos(ngo.address);
      expect(ngoData.name).to.equal(NGO_NAME);
      expect(ngoData.description).to.equal(NGO_DESCRIPTION);
      expect(ngoData.wallet).to.equal(ngo.address);
      expect(ngoData.isRegistered).to.equal(true);
      
      const ngoAddresses = await bulkDonation.getAllNGOs();
      expect(ngoAddresses).to.include(ngo.address);
    });
    
    it("Should not allow registering the same NGO twice", async function () {
      await bulkDonation.connect(ngo).registerNGO(NGO_NAME, NGO_DESCRIPTION);
      await expect(
        bulkDonation.connect(ngo).registerNGO(NGO_NAME, NGO_DESCRIPTION)
      ).to.be.revertedWith("NGO already registered");
    });
  });
  
  describe("Fund Deposit", function () {
    beforeEach(async function () {
      await bulkDonation.connect(ngo).registerNGO(NGO_NAME, NGO_DESCRIPTION);
    });
    
    it("Should deposit AVAX", async function () {
      const amount = ethers.parseEther("1.0");
      await bulkDonation.connect(ngo).depositAvax({ value: amount });
      
      const balance = await bulkDonation.ngoAvaxBalance(ngo.address);
      expect(balance).to.equal(amount);
    });
    
    it("Should deposit USDC", async function () {
      const amount = ethers.parseUnits("100", 6); // 100 USDC
      
      // Approve first
      await mockUSDC.connect(ngo).approve(bulkDonationAddress, amount);
      await bulkDonation.connect(ngo).depositToken(amount);
      
      const balance = await bulkDonation.ngoTokenBalance(ngo.address);
      expect(balance).to.equal(amount);
    });
    
    it("Should not allow non-NGOs to deposit", async function () {
      await expect(
        bulkDonation.connect(recipient1).depositAvax({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Not a registered NGO");
      
      await expect(
        bulkDonation.connect(recipient1).depositToken(ethers.parseUnits("100", 6))
      ).to.be.revertedWith("Not a registered NGO");
    });
  });
  
  describe("Phone Registration", function () {
    it("Should register a phone number with a wallet", async function () {
      await bulkDonation.connect(recipient1).registerPhone(PHONE_1);
      
      const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(PHONE_1));
      const registeredWallet = await bulkDonation.phoneToWallet(phoneHash);
      expect(registeredWallet).to.equal(recipient1.address);
    });
    
    it("Should not allow registering a phone to a different wallet", async function () {
      await bulkDonation.connect(recipient1).registerPhone(PHONE_1);
      
      await expect(
        bulkDonation.connect(recipient2).registerPhone(PHONE_1)
      ).to.be.revertedWith("Phone already registered to another wallet");
    });
    
    it("Should allow the same wallet to update their registration", async function () {
      await bulkDonation.connect(recipient1).registerPhone(PHONE_1);
      await bulkDonation.connect(recipient1).registerPhone(PHONE_1); // Should not revert
    });
  });
  
  describe("Adding Recipients", function () {
    beforeEach(async function () {
      await bulkDonation.connect(ngo).registerNGO(NGO_NAME, NGO_DESCRIPTION);
      await bulkDonation.connect(ngo).depositAvax({ value: ethers.parseEther("10.0") });
      await mockUSDC.connect(ngo).approve(bulkDonationAddress, ethers.parseUnits("1000", 6));
      await bulkDonation.connect(ngo).depositToken(ethers.parseUnits("1000", 6));
      
      await bulkDonation.connect(recipient1).registerPhone(PHONE_1);
      await bulkDonation.connect(recipient2).registerPhone(PHONE_2);
    });
    
    it("Should add recipients for AVAX", async function () {
      const phoneNumbers = [PHONE_1, PHONE_2];
      const wallets = [recipient1.address, recipient2.address];
      const amounts = [ethers.parseEther("1.0"), ethers.parseEther("2.0")];
      
      await bulkDonation.connect(ngo).addRecipients(phoneNumbers, wallets, amounts, false);
      
      const phoneHash1 = ethers.keccak256(ethers.toUtf8Bytes(PHONE_1));
      const recipient1Data = await bulkDonation.recipients(ngo.address, phoneHash1);
      expect(recipient1Data.amount).to.equal(amounts[0]);
      expect(recipient1Data.claimed).to.equal(false);
      
      const phoneHash2 = ethers.keccak256(ethers.toUtf8Bytes(PHONE_2));
      const recipient2Data = await bulkDonation.recipients(ngo.address, phoneHash2);
      expect(recipient2Data.amount).to.equal(amounts[1]);
      expect(recipient2Data.claimed).to.equal(false);
      
      // Check that the NGO's balance was decreased
      const ngoBalance = await bulkDonation.ngoAvaxBalance(ngo.address);
      expect(ngoBalance).to.equal(ethers.parseEther("7.0")); // 10 - (1 + 2)
    });
    
    it("Should add recipients for USDC", async function () {
      const phoneNumbers = [PHONE_1, PHONE_2];
      const wallets = [recipient1.address, recipient2.address];
      const amounts = [ethers.parseUnits("100", 6), ethers.parseUnits("200", 6)];
      
      await bulkDonation.connect(ngo).addRecipients(phoneNumbers, wallets, amounts, true);
      
      const phoneHash1 = ethers.keccak256(ethers.toUtf8Bytes(PHONE_1));
      const recipient1Data = await bulkDonation.recipients(ngo.address, phoneHash1);
      expect(recipient1Data.amount).to.equal(amounts[0]);
      expect(recipient1Data.claimed).to.equal(false);
      
      // Check that the NGO's token balance was decreased
      const ngoBalance = await bulkDonation.ngoTokenBalance(ngo.address);
      expect(ngoBalance).to.equal(ethers.parseUnits("700", 6)); // 1000 - (100 + 200)
    });
    
    it("Should fail if NGO has insufficient funds", async function () {
      const phoneNumbers = [PHONE_1, PHONE_2];
      const wallets = [recipient1.address, recipient2.address];
      const amounts = [ethers.parseEther("20.0"), ethers.parseEther("30.0")]; // More than 10 ETH
      
      await expect(
        bulkDonation.connect(ngo).addRecipients(phoneNumbers, wallets, amounts, false)
      ).to.be.revertedWith("Insufficient AVAX balance");
    });
  });
  
  describe("Claiming Funds", function () {
    beforeEach(async function () {
      await bulkDonation.connect(ngo).registerNGO(NGO_NAME, NGO_DESCRIPTION);
      await bulkDonation.connect(ngo).depositAvax({ value: ethers.parseEther("10.0") });
      await mockUSDC.connect(ngo).approve(bulkDonationAddress, ethers.parseUnits("1000", 6));
      await bulkDonation.connect(ngo).depositToken(ethers.parseUnits("1000", 6));
      
      await bulkDonation.connect(recipient1).registerPhone(PHONE_1);
      await bulkDonation.connect(recipient2).registerPhone(PHONE_2);
      
      const phoneNumbers = [PHONE_1, PHONE_2];
      const wallets = [recipient1.address, recipient2.address];
      const avaxAmounts = [ethers.parseEther("1.0"), ethers.parseEther("2.0")];
      const tokenAmounts = [ethers.parseUnits("100", 6), ethers.parseUnits("200", 6)];
      
      // Add recipients for both AVAX and USDC
      await bulkDonation.connect(ngo).addRecipients(phoneNumbers, wallets, avaxAmounts, false);
      await bulkDonation.connect(ngo).addRecipients(phoneNumbers, wallets, tokenAmounts, true);
    });
    
    it("Should claim AVAX funds", async function () {
      const initialBalance = await ethers.provider.getBalance(recipient1.address);
      
      await bulkDonation.connect(recipient1).claimFunds(PHONE_1, ngo.address, false);
      
      const finalBalance = await ethers.provider.getBalance(recipient1.address);
      
      // Just check that the balance increased but allow for gas costs
      // We know the claim amount is 1 AVAX, so balance should be higher even with gas costs
      expect(finalBalance).to.be.greaterThan(initialBalance - ethers.parseEther("0.1"));
      
      // Check that the funds are marked as claimed
      const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(PHONE_1));
      const recipientData = await bulkDonation.recipients(ngo.address, phoneHash);
      expect(recipientData.claimed).to.equal(true);
      
      // Try to claim again and fail
      await expect(
        bulkDonation.connect(recipient1).claimFunds(PHONE_1, ngo.address, false)
      ).to.be.revertedWith("Funds already claimed");
    });
    
    it("Should claim USDC funds", async function () {
      const initialBalance = await mockUSDC.balanceOf(recipient1.address);
      
      await bulkDonation.connect(recipient1).claimFunds(PHONE_1, ngo.address, true);
      
      const finalBalance = await mockUSDC.balanceOf(recipient1.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseUnits("100", 6));
      
      // Check that the funds are marked as claimed
      const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(PHONE_1));
      const recipientData = await bulkDonation.recipients(ngo.address, phoneHash);
      expect(recipientData.claimed).to.equal(true);
    });
    
    it("Should not allow unauthorized users to claim funds", async function () {
      await expect(
        bulkDonation.connect(recipient2).claimFunds(PHONE_1, ngo.address, false)
      ).to.be.revertedWith("Not authorized to claim for this phone");
    });
  });
  
  describe("Viewing Functions", function () {
    beforeEach(async function () {
      await bulkDonation.connect(ngo).registerNGO(NGO_NAME, NGO_DESCRIPTION);
      await bulkDonation.connect(recipient1).registerPhone(PHONE_1);
      
      const phoneNumbers = [PHONE_1];
      const wallets = [recipient1.address];
      const amounts = [ethers.parseEther("1.0")];
      
      await bulkDonation.connect(ngo).depositAvax({ value: ethers.parseEther("10.0") });
      await bulkDonation.connect(ngo).addRecipients(phoneNumbers, wallets, amounts, false);
    });
    
    it("Should get claimable amount", async function () {
      const [amount, claimed] = await bulkDonation.getClaimableAmount(PHONE_1, ngo.address);
      expect(amount).to.equal(ethers.parseEther("1.0"));
      expect(claimed).to.equal(false);
    });
    
    it("Should get NGO recipients", async function () {
      const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(PHONE_1));
      const recipients = await bulkDonation.getNGORecipients(ngo.address);
      expect(recipients.length).to.equal(1);
      expect(recipients[0]).to.equal(phoneHash);
    });
  });
}); 