import { ethers } from 'ethers';
import { DonationEntry } from '../utils/pdfParser';

/**
 * Send bulk donations
 * @param contract The BulkDonation contract instance
 * @param entries Array of donation entries containing wallet addresses and amounts
 * @returns Transaction hash
 */
export const sendBulkDonations = async (
  contract: ethers.Contract,
  entries: DonationEntry[]
): Promise<string> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    // Extract phone numbers, wallet addresses and amounts from entries
    const phoneNumbers = entries.map(entry => entry.phoneNumber);
    const walletAddresses = entries.map(entry => entry.walletAddress);
    
    // Convert amounts to the correct format with decimal handling
    const amounts = entries.map(entry => {
      try {
        return ethers.parseUnits(entry.amount, 6); // USDC has 6 decimals
      } catch (error) {
        console.error(`Error parsing amount ${entry.amount}:`, error);
        // Alternative parsing - convert to number then to BigInt
        const amount = parseFloat(entry.amount);
        const factor = 10n ** 6n;
        return BigInt(Math.floor(amount * 1000000));
      }
    });
    
    console.log("Adding recipients:", {
      phoneNumbers,
      walletAddresses,
      amounts: amounts.map(a => a.toString())
    });
    
    // Call the addRecipients function with USDC token (isToken = true)
    const tx = await contract.addRecipients(
      phoneNumbers,
      walletAddresses,
      amounts,
      true // use token (USDC) instead of AVAX
    );
    await tx.wait();
    
    return tx.hash;
  } catch (error: any) {
    console.error('Error sending bulk donation:', error);
    throw new Error(error.message || 'Failed to send donations');
  }
};

/**
 * Check if user has approved USDC for the contract
 * @param contract The BulkDonation contract instance
 * @param account User's wallet address
 * @returns Boolean indicating if approval is needed
 */
export const checkUSDCApproval = async (
  contract: ethers.Contract,
  account: string
): Promise<boolean> => {
  try {
    if (!contract || !account) {
      throw new Error('Contract or account not initialized');
    }

    // Get the USDC token address from the contract
    const usdcAddress = await contract.usdcToken();
    
    // Get the contract provider
    const provider = contract.runner?.provider;
    if (!provider) {
      throw new Error('Provider not available');
    }
    
    // Create USDC token contract instance for read-only operations
    const usdcContract = new ethers.Contract(
      usdcAddress,
      [
        "function allowance(address owner, address spender) view returns (uint256)"
      ],
      provider
    );
    
    // Get the BulkDonation contract address
    const contractAddress = await contract.getAddress();
    
    // Check the allowance
    const allowance = await usdcContract.allowance(account, contractAddress);
    
    // Return true if allowance is greater than 0
    return allowance > 0;
  } catch (error) {
    console.error('Error checking USDC approval:', error);
    return false;
  }
};

/**
 * Approve USDC for the contract
 * @param contract The BulkDonation contract instance
 * @returns Transaction hash
 */
export const approveUSDC = async (
  contract: ethers.Contract
): Promise<string> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    // Get the USDC token address from the contract
    const usdcAddress = await contract.usdcToken();
    
    // Get the contract provider and signer
    const signer = contract.runner;
    if (!signer) {
      throw new Error('No signer available');
    }
    
    // Create USDC token contract instance
    const usdcContract = new ethers.Contract(
      usdcAddress,
      [
        "function approve(address spender, uint256 amount) public returns (bool)"
      ],
      signer
    );
    
    // Approve a large amount (max uint256)
    const MAX_AMOUNT = ethers.MaxUint256;
    const contractAddress = await contract.getAddress();
    
    // Call approve on the USDC token contract
    const tx = await usdcContract.approve(contractAddress, MAX_AMOUNT);
    await tx.wait();
    
    return tx.hash;
  } catch (error: any) {
    console.error('Error approving USDC:', error);
    throw new Error(`Error approving USDC: ${error.message}`);
  }
};

/**
 * Register as an NGO
 * @param contract The BulkDonation contract instance 
 * @param name Name of the NGO
 * @param description Description of the NGO
 * @returns Transaction hash
 */
export const registerNGO = async (
  contract: ethers.Contract,
  name: string,
  description: string
): Promise<string> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    // Get signer information
    const signer = contract.runner;
    if (!signer) {
      throw new Error('No signer available');
    }
    
    let signerAddress;
    try {
      if ('getAddress' in signer) {
        signerAddress = await (signer as any).getAddress();
        console.log("Registering NGO with wallet:", signerAddress);
      }
    } catch (err) {
      console.warn("Could not get signer address:", err);
    }
    
    // Check if already registered (to prevent unnecessary transactions)
    try {
      const ngoData = await contract.ngos(signerAddress);
      console.log("Current NGO status:", ngoData);
      
      if (ngoData && ngoData.isRegistered) {
        console.log("Already registered as NGO");
        return "Already registered";
      }
    } catch (err) {
      console.warn("Error checking NGO status:", err);
    }
    
    // Call the registerNGO function on the contract
    console.log(`Registering NGO with name="${name}" and description="${description}"`);
    const tx = await contract.registerNGO(name, description);
    console.log("Registration transaction sent:", tx.hash);
    
    await tx.wait();
    console.log("NGO Registration transaction confirmed");
    
    // Verify registration was successful
    try {
      const ngoData = await contract.ngos(signerAddress);
      console.log("NGO registration result:", ngoData);
      
      if (!ngoData || !ngoData.isRegistered) {
        throw new Error("Registration verification failed. NGO not registered.");
      }
    } catch (err) {
      console.error("Error verifying NGO registration:", err);
      throw new Error("Failed to verify NGO registration. Please check if your transaction was successful.");
    }
    
    return tx.hash;
  } catch (error: any) {
    console.error('Error registering NGO:', error);
    throw new Error(`Error registering NGO: ${error.message}`);
  }
};

/**
 * Check if a wallet is registered as an NGO
 * @param contract The BulkDonation contract instance
 * @param account User's wallet address
 * @returns Boolean indicating if the wallet is registered as an NGO
 */
export const checkNGORegistration = async (
  contract: ethers.Contract,
  account: string
): Promise<boolean> => {
  try {
    if (!contract || !account) {
      console.warn('Contract or account not initialized');
      return false;
    }
    
    console.log(`Checking if wallet ${account} is registered as NGO`);
    
    // Get NGO data from the contract
    const ngoData = await contract.ngos(account);
    console.log(`NGO data for wallet ${account}:`, ngoData);
    
    // Return true if the NGO is registered
    const isRegistered = ngoData && ngoData.isRegistered;
    console.log(`Wallet ${account} is ${isRegistered ? 'registered' : 'not registered'} as NGO`);
    
    return isRegistered;
  } catch (error) {
    console.error('Error checking NGO registration:', error);
    return false;
  }
};

/**
 * Check the USDC balance of a user
 * @param contract The BulkDonation contract instance
 * @param account User's wallet address
 * @returns USDC balance formatted as a string with 6 decimal places
 */
export const checkUSDCBalance = async (
  contract: ethers.Contract,
  account: string
): Promise<string> => {
  try {
    if (!contract || !account) {
      throw new Error('Contract or account not initialized');
    }
    
    // Get the USDC token address from the contract
    const usdcAddress = await contract.usdcToken();
    
    // Get the contract provider
    const provider = contract.runner?.provider;
    if (!provider) {
      throw new Error('Provider not available');
    }
    
    // Create USDC token contract instance for read-only operations
    const usdcContract = new ethers.Contract(
      usdcAddress,
      [
        "function balanceOf(address owner) view returns (uint256)"
      ],
      provider
    );
    
    // Get the user's USDC balance
    const balance = await usdcContract.balanceOf(account);
    
    // Format the balance (USDC has 6 decimals)
    const formattedBalance = ethers.formatUnits(balance, 6);
    
    return formattedBalance;
  } catch (error: any) {
    console.error('Error checking USDC balance:', error);
    throw new Error(`Error checking USDC balance: ${error.message}`);
  }
};

/**
 * Deposit USDC tokens into the contract
 * @param contract The BulkDonation contract instance
 * @param amount Amount to deposit in USDC (will be converted to the correct units)
 * @returns Transaction hash
 */
export const depositUSDC = async (
  contract: ethers.Contract,
  amount: string
): Promise<string> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    // Convert amount to USDC units (6 decimals)
    const amountInUnits = ethers.parseUnits(amount, 6);
    
    // First approve the tokens
    const usdcAddress = await contract.usdcToken();
    const signer = contract.runner;
    
    if (!signer) {
      throw new Error('No signer available');
    }
    
    // Create USDC token contract instance
    const usdcContract = new ethers.Contract(
      usdcAddress,
      [
        "function approve(address spender, uint256 amount) public returns (bool)"
      ],
      signer
    );
    
    // Approve the tokens first
    const approveTx = await usdcContract.approve(await contract.getAddress(), amountInUnits);
    await approveTx.wait();
    
    // Now deposit the tokens
    const tx = await contract.depositToken(amountInUnits);
    await tx.wait();
    
    return tx.hash;
  } catch (error: any) {
    console.error('Error depositing USDC:', error);
    throw new Error(`Error depositing USDC: ${error.message}`);
  }
};

/**
 * Check the NGO token balance in the contract (not wallet balance)
 * @param contract The BulkDonation contract instance
 * @param account User's wallet address
 * @returns NGO's token balance in the contract formatted as a string
 */
export const checkNGOTokenBalance = async (
  contract: ethers.Contract,
  account: string
): Promise<string> => {
  try {
    if (!contract || !account) {
      throw new Error('Contract or account not initialized');
    }
    
    // Get the NGO's token balance from the contract
    const balance = await contract.ngoTokenBalance(account);
    
    // Format the balance (USDC has 6 decimals)
    const formattedBalance = ethers.formatUnits(balance, 6);
    
    return formattedBalance;
  } catch (error: any) {
    console.error('Error checking NGO token balance:', error);
    throw new Error(`Error checking NGO token balance: ${error.message}`);
  }
};

/**
 * Register a phone number with the user's wallet address
 * @param contract The BulkDonation contract instance
 * @param phoneNumber The phone number to register
 * @param force Whether to force registration even if already registered to another wallet
 * @returns Transaction hash
 */
export const registerPhone = async (
  contract: ethers.Contract,
  phoneNumber: string,
  force: boolean = false
): Promise<string> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    // Get current wallet address
    const signer = contract.runner;
    if (!signer) {
      throw new Error('No signer available');
    }
    
    let signerAddress;
    try {
      if ('getAddress' in signer) {
        signerAddress = await (signer as any).getAddress();
        console.log("Registering phone to wallet:", signerAddress);
      }
    } catch (err) {
      console.warn("Could not get signer address:", err);
    }
    
    // Generate phone hash for logging
    const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(phoneNumber));
    
    // Check current registration status
    const currentRegistration = await contract.phoneToWallet(phoneHash);
    console.log("Current phone registration status:", {
      phoneNumber,
      phoneHash,
      registeredTo: currentRegistration,
      isZeroAddress: currentRegistration === ethers.ZeroAddress
    });
    
    // Call the registerPhone function on the contract with force parameter
    console.log(`Calling contract.registerPhone with: ${phoneNumber}, force=${force}`);
    
    let tx;
    try {
      console.log("Attempting to register with force parameter...");
      // Try to use the new function with force parameter
      tx = await contract.registerPhone(phoneNumber, force);
      console.log("Registration with force parameter succeeded");
    } catch (err) {
      console.error("Failed to call with force parameter:", err);
      
      // Try the version without force parameter
      try {
        console.log("Falling back to old function without force parameter...");
        // Fall back to the old function if the new one is not available
        tx = await contract.registerPhone(phoneNumber);
        console.log("Registration without force parameter succeeded");
      } catch (innerErr) {
        console.error("Registration failed with both methods:", innerErr);
        throw innerErr;
      }
    }
    
    console.log("Registration transaction sent:", tx.hash);
    
    try {
      const receipt = await tx.wait();
      console.log("Registration transaction confirmed:", receipt);
      return tx.hash;
    } catch (err) {
      console.error("Error waiting for transaction confirmation:", err);
      throw err;
    }
  } catch (error: any) {
    console.error('Error registering phone:', error);
    // Include more details in the error message
    if (error.reason) {
      throw new Error(`Registration failed: ${error.reason}`);
    } else if (error.message) {
      throw new Error(`Registration failed: ${error.message}`);
    } else {
      throw new Error('Registration failed. Please try again.');
    }
  }
};

/**
 * Check if a phone number is registered to the current wallet
 * @param contract The BulkDonation contract instance
 * @param phoneNumber The phone number to check
 * @param account The user's wallet address
 * @returns Boolean indicating if the phone is registered to this wallet
 */
export const checkPhoneRegistered = async (
  contract: ethers.Contract,
  phoneNumber: string,
  account: string
): Promise<boolean> => {
  try {
    if (!contract || !account) {
      throw new Error('Contract or account not initialized');
    }
    
    console.log(`Checking if phone ${phoneNumber} is registered to wallet ${account}`);
    
    // Generate the phone hash the same way the contract does
    const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(phoneNumber));
    
    // Check if this phone hash is registered to any wallet
    const registeredWallet = await contract.phoneToWallet(phoneHash);
    console.log("Phone hash:", phoneHash);
    console.log("Registered wallet:", registeredWallet);
    
    // Return true if registered to current account, false otherwise
    return registeredWallet.toLowerCase() === account.toLowerCase();
  } catch (error: any) {
    console.error('Error checking phone registration:', error);
    return false;
  }
};

/**
 * Get the wallet address registered to a phone number
 * @param contract The BulkDonation contract instance
 * @param phoneNumber The phone number to check
 * @returns The wallet address registered to the phone number, or null if not registered
 */
export const getPhoneRegisteredWallet = async (
  contract: ethers.Contract,
  phoneNumber: string
): Promise<string | null> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    // Generate the phone hash the same way the contract does
    const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(phoneNumber));
    
    // Check if this phone hash is registered to any wallet
    const registeredWallet = await contract.phoneToWallet(phoneHash);
    
    // Return null if not registered to any wallet
    if (registeredWallet === ethers.ZeroAddress) {
      return null;
    }
    
    return registeredWallet;
  } catch (error: any) {
    console.error('Error getting registered wallet for phone:', error);
    return null;
  }
};

/**
 * Check if a phone number is already assigned to a recipient in the donation list
 * @param contract The BulkDonation contract instance
 * @param phoneNumber The phone number to check
 * @param ngoAddress The NGO address to check against
 * @returns Object with assigned wallet and amount if found, null otherwise
 */
export const getPhoneAssignedRecipient = async (
  contract: ethers.Contract,
  phoneNumber: string,
  ngoAddress: string
): Promise<{wallet: string, amount: string, claimed: boolean} | null> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    // Generate the phone hash
    const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(phoneNumber));
    
    // Get recipient data directly from the contract
    const recipient = await contract.recipients(ngoAddress, phoneHash);
    console.log(`RECIPIENT DATA RAW for phone ${phoneNumber} at NGO ${ngoAddress}:`, recipient);
    console.log(`ASSIGNED WALLET for phone ${phoneNumber}: ${recipient.wallet}`);
    
    // If amount is 0, this phone is not assigned to any recipient for this NGO
    if (recipient.amount.toString() === '0') {
      return null;
    }
    
    // Make sure wallet is properly formatted
    const walletAddress = recipient.wallet ? recipient.wallet.toString() : ethers.ZeroAddress;
    
    console.log('RETURNING RECIPIENT DATA:', {
      wallet: walletAddress,
      amount: ethers.formatUnits(recipient.amount, 6),
      claimed: recipient.claimed
    });
    
    return {
      wallet: walletAddress,
      amount: ethers.formatUnits(recipient.amount, 6),
      claimed: recipient.claimed
    };
  } catch (error: any) {
    console.error('Error checking assigned recipient:', error);
    return null;
  }
};

/**
 * Get all registered NGOs
 * @param contract The BulkDonation contract instance
 * @returns Array of NGO addresses
 */
export const getAllNGOs = async (
  contract: ethers.Contract
): Promise<string[]> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    const ngoAddresses = await contract.getAllNGOs();
    return ngoAddresses;
  } catch (error: any) {
    console.error('Error getting NGOs:', error);
    throw new Error(`Error getting NGOs: ${error.message}`);
  }
};

/**
 * Get NGO details
 * @param contract The BulkDonation contract instance
 * @param ngoAddress The NGO's address
 * @returns NGO details object
 */
export const getNGODetails = async (
  contract: ethers.Contract,
  ngoAddress: string
): Promise<any> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    const ngoData = await contract.ngos(ngoAddress);
    
    return {
      name: ngoData.name,
      description: ngoData.description,
      wallet: ngoData.wallet,
      isRegistered: ngoData.isRegistered
    };
  } catch (error: any) {
    console.error('Error getting NGO details:', error);
    throw new Error(`Error getting NGO details: ${error.message}`);
  }
};

/**
 * Get claimable amount for a phone number from a specific NGO
 * @param contract The BulkDonation contract instance
 * @param phoneNumber The recipient's phone number
 * @param ngoAddress The NGO's address
 * @returns Object with amount and claimed status
 */
export const getClaimableAmount = async (
  contract: ethers.Contract,
  phoneNumber: string,
  ngoAddress: string
): Promise<{ amount: string, claimed: boolean }> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    const [amount, claimed] = await contract.getClaimableAmount(phoneNumber, ngoAddress);
    
    // Format the amount (USDC has 6 decimals)
    const formattedAmount = ethers.formatUnits(amount, 6);
    
    return {
      amount: formattedAmount,
      claimed
    };
  } catch (error: any) {
    console.error('Error checking claimable amount:', error);
    return { amount: '0', claimed: false };
  }
};

/**
 * Claim funds from an NGO
 * @param contract The BulkDonation contract instance
 * @param phoneNumber The recipient's phone number
 * @param ngoAddress The NGO's address
 * @param isToken Whether claiming token (USDC) or AVAX
 * @returns Transaction hash
 */
export const claimFunds = async (
  contract: ethers.Contract,
  phoneNumber: string,
  ngoAddress: string,
  isToken: boolean
): Promise<string> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    console.log("Claiming funds with params:", {
      phoneNumber,
      ngoAddress,
      isToken
    });
    
    // Make sure we're using the recipient's signer
    const signer = contract.runner;
    if (!signer) {
      throw new Error("No signer available");
    }
    
    // Get the current wallet address if possible
    try {
      if ('getAddress' in signer) {
        const signerAddress = await (signer as any).getAddress();
        console.log("Claiming with wallet:", signerAddress);
      }
    } catch (err) {
      console.warn("Could not get signer address:", err);
    }
    
    // Call the claimFunds function on the contract
    const tx = await contract.claimFunds(phoneNumber, ngoAddress, isToken);
    console.log("Claim transaction sent:", tx.hash);
    
    await tx.wait();
    console.log("Claim transaction confirmed");
    
    return tx.hash;
  } catch (error: any) {
    console.error('Error claiming funds:', error);
    throw new Error(`Error claiming funds: ${error.message}`);
  }
};

/**
 * Direct check if wallet can send donations
 * @param contract The BulkDonation contract instance
 * @param account User's wallet address 
 * @returns A detailed status object
 */
export const diagnoseDonationAbility = async (
  contract: ethers.Contract,
  account: string
): Promise<{canDonate: boolean, reason: string, details: any}> => {
  try {
    if (!contract || !account) {
      return {
        canDonate: false,
        reason: "Contract or account not initialized",
        details: {contract: !!contract, account}
      };
    }
    
    // Get contract address for logging
    let contractAddress;
    try {
      contractAddress = await contract.getAddress();
    } catch (err) {
      console.warn("Could not get contract address:", err);
    }
    
    console.log(`Diagnosing if wallet ${account} can donate using contract at ${contractAddress}`);
    
    // Step 1: Check if wallet is registered as NGO
    try {
      const ngoData = await contract.ngos(account);
      console.log("NGO data:", ngoData);
      
      if (!ngoData || !ngoData.isRegistered) {
        return {
          canDonate: false,
          reason: "Not registered as an NGO",
          details: ngoData
        };
      }
      
      // Step 2: Check contract token balance
      const tokenBalance = await contract.ngoTokenBalance(account);
      console.log("NGO token balance in contract:", tokenBalance.toString());
      
      if (tokenBalance.toString() === "0") {
        return {
          canDonate: false,
          reason: "No USDC tokens deposited in contract",
          details: {tokenBalance: tokenBalance.toString()}
        };
      }
      
      // If we got here, everything looks good
      return {
        canDonate: true,
        reason: "All checks passed",
        details: {
          isRegistered: ngoData.isRegistered,
          name: ngoData.name,
          tokenBalance: tokenBalance.toString()
        }
      };
    } catch (err) {
      console.error("Error checking NGO status:", err);
      return {
        canDonate: false,
        reason: "Error checking NGO status",
        details: err
      };
    }
  } catch (error) {
    console.error("Error diagnosing donation ability:", error);
    return {
      canDonate: false,
      reason: "Unknown error during diagnosis",
      details: error
    };
  }
};

/**
 * Update a recipient's wallet address (NGO only)
 * @param contract The BulkDonation contract instance
 * @param phoneNumber The phone number of the recipient
 * @param newWalletAddress The new wallet address to assign to this recipient
 * @returns Transaction hash
 */
export const updateRecipientWallet = async (
  contract: ethers.Contract,
  phoneNumber: string,
  newWalletAddress: string
): Promise<string> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    // Validate the new wallet address
    if (!ethers.isAddress(newWalletAddress)) {
      throw new Error('Invalid wallet address');
    }
    
    console.log(`Updating recipient wallet for phone ${phoneNumber} to ${newWalletAddress}`);
    
    // Call the updateRecipientWallet function on the contract
    const tx = await contract.updateRecipientWallet(phoneNumber, newWalletAddress);
    console.log('Transaction sent:', tx.hash);
    
    await tx.wait();
    console.log('Recipient wallet updated successfully');
    
    return tx.hash;
  } catch (error: any) {
    console.error('Error updating recipient wallet:', error);
    throw new Error(`Failed to update recipient wallet: ${error.message}`);
  }
};

/**
 * Request wallet reassignment for a recipient - allows a recipient to request their funds be reassigned to their wallet
 * @param contract The BulkDonation contract instance
 * @param phoneNumber The phone number linked to the funds
 * @param ngoAddress The NGO address that sent the funds
 * @returns Transaction hash
 */
export const requestWalletReassignment = async (
  contract: ethers.Contract,
  phoneNumber: string,
  ngoAddress: string
): Promise<string> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    // Get current wallet address
    const signer = contract.runner;
    if (!signer) {
      throw new Error('No signer available');
    }
    
    let signerAddress;
    try {
      if ('getAddress' in signer) {
        signerAddress = await (signer as any).getAddress();
        console.log("Requesting reassignment to wallet:", signerAddress);
      }
    } catch (err) {
      console.warn("Could not get signer address:", err);
    }
    
    // Generate phone hash for logging
    const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(phoneNumber));
    
    // Check if this phone has funds assigned by this NGO
    const recipient = await contract.recipients(ngoAddress, phoneHash);
    console.log("Recipient data:", recipient);
    
    if (recipient.amount.toString() === '0') {
      throw new Error("No funds assigned to this phone number by this NGO");
    }
    
    if (recipient.claimed) {
      throw new Error("Funds have already been claimed");
    }
    
    // Log current wallet assignment
    console.log(`Current wallet assigned to phone ${phoneNumber}: ${recipient.wallet}`);
    console.log(`Requesting reassignment to wallet: ${signerAddress}`);
    
    // Call the requestWalletReassignment function
    const tx = await contract.requestWalletReassignment(phoneNumber, ngoAddress);
    console.log("Reassignment request sent:", tx.hash);
    
    await tx.wait();
    console.log("Reassignment request confirmed");
    
    return tx.hash;
  } catch (error: any) {
    console.error('Error requesting wallet reassignment:', error);
    throw new Error(`Failed to request wallet reassignment: ${error.message}`);
  }
};

/**
 * Claim funds directly - simplified approach that ignores wallet verification
 * @param contract The BulkDonation contract instance
 * @param phoneNumber The phone number
 * @param ngoAddress The NGO address
 * @returns Transaction hash
 */
export const claimDirectly = async (
  contract: ethers.Contract,
  phoneNumber: string,
  ngoAddress: string
): Promise<string> => {
  try {
    if (!contract) {
      throw new Error('Contract not initialized');
    }
    
    console.log(`Directly claiming funds for phone ${phoneNumber} from NGO ${ngoAddress}`);
    
    // Call the claimDirectly function (true for USDC token)
    const tx = await contract.claimDirectly(phoneNumber, ngoAddress, true);
    console.log("Claim transaction sent:", tx.hash);
    
    await tx.wait();
    console.log("Claim transaction confirmed");
    
    return tx.hash;
  } catch (error: any) {
    console.error('Error claiming funds directly:', error);
    throw new Error(`Failed to claim funds: ${error.message}`);
  }
};

/**
 * Get the count of recipients added by the NGO
 * @param contract The BulkDonation contract instance
 * @returns Number of recipients
 */
export const getRecipientsCount = async (contract: ethers.Contract): Promise<number> => {
  try {
    if (!contract) {
      throw new Error("Contract not initialized");
    }
    
    console.log("Getting recipients count");
    
    try {
      // Try to call the function directly if it exists
      const count = await contract.getRecipientsCount();
      return count.toNumber();
    } catch (err) {
      console.warn("getRecipientsCount function not found, estimating from NGO data", err);
      
      // Alternative: check if the NGO has any recipients
      // Get the current signer
      const signer = contract.runner;
      if (!signer) {
        throw new Error("No signer available");
      }
      
      // Get address
      let signerAddress;
      try {
        if ('getAddress' in signer) {
          signerAddress = await (signer as any).getAddress();
        }
      } catch (err) {
        console.warn("Could not get signer address:", err);
        return 0;
      }
      
      try {
        // Check if the NGO is registered
        const ngoData = await contract.ngos(signerAddress);
        if (!ngoData || !ngoData.isRegistered) {
          return 0;
        }
        
        // For now, return 1 if registered as an indication of activity
        return 1;
      } catch (err) {
        console.error("Error checking NGO status:", err);
        return 0;
      }
    }
  } catch (error: any) {
    console.error("Error getting recipients count:", error);
    return 0;
  }
}; 