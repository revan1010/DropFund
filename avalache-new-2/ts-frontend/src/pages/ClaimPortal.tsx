import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import { 
  registerPhone, 
  checkPhoneRegistered, 
  getPhoneRegisteredWallet,
  getPhoneAssignedRecipient,
  getAllNGOs, 
  getNGODetails, 
  getClaimableAmount, 
  claimFunds,
  requestWalletReassignment,
  claimDirectly
} from '../services/contractService';
import { ethers } from 'ethers';
import '../styles/claim-portal.css';

interface ClaimableNGO {
  address: string;
  name: string;
  description: string;
  amount: string;
  claimed: boolean;
  wallet: string;
}

const ClaimPortal = () => {
  const { isConnected, isCorrectNetwork, connect, switchToFuji, contract, account } = useWeb3();
  const navigate = useNavigate();

  // Phone registration state
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isPhoneRegistered, setIsPhoneRegistered] = useState<boolean | null>(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [registeredWallet, setRegisteredWallet] = useState<string | null>(null);

  // OTP verification state (mock)
  const [showOTPVerification, setShowOTPVerification] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>('');
  const [isVerifyingOTP, setIsVerifyingOTP] = useState<boolean>(false);
  const [mockOTP, setMockOTP] = useState<string>('');

  // Claimable funds state
  const [claimableNGOs, setClaimableNGOs] = useState<ClaimableNGO[]>([]);
  const [isLoadingNGOs, setIsLoadingNGOs] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimingNGOAddress, setClaimingNGOAddress] = useState<string | null>(null);
  
  // Transaction and error state
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // New assignment check state
  const [showAssignmentCheck, setShowAssignmentCheck] = useState<boolean>(false);
  const [assignmentCheckResult, setAssignmentCheckResult] = useState<{
    ngoName: string;
    ngoAddress: string;
    walletAddress: string;
    amount: string;
    claimed: boolean;
  } | null>(null);
  const [isCheckingAssignment, setIsCheckingAssignment] = useState<boolean>(false);
  
  // New state for reassignment
  const [isReassigning, setIsReassigning] = useState<boolean>(false);
  const [reassigningNGOAddress, setReassigningNGOAddress] = useState<string | null>(null);
  
  // Add state for direct claiming
  const [isDirectlyClaiming, setIsDirectlyClaiming] = useState<boolean>(false);
  
  // Check if user is connected and on the right network
  useEffect(() => {
    if (!isConnected) {
      navigate('/');
    }
  }, [isConnected, navigate]);

  // Check if phone is registered when contract and account are available
  useEffect(() => {
    const checkPhoneRegistration = async () => {
      if (contract && account && isConnected && isCorrectNetwork && phoneNumber) {
        try {
          setIsCheckingPhone(true);
          setError(null);
          console.log("Checking if phone", phoneNumber, "is registered to wallet", account);
          
          // Check all NGOs to see if this phone has been assigned to this wallet
          const ngoAddresses = await getAllNGOs(contract);
          let isAssignedToCurrentWallet = false;
          let isAssignedToOtherWallet = false;
          let assignedWalletAddress = null;
          
          for (const ngoAddress of ngoAddresses) {
            try {
              const recipientData = await getPhoneAssignedRecipient(contract, phoneNumber, ngoAddress);
              if (recipientData) {
                console.log(`Phone ${phoneNumber} is assigned in NGO ${ngoAddress} to wallet:`, recipientData.wallet);
                
                if (recipientData.wallet.toLowerCase() === account.toLowerCase()) {
                  console.log("Phone is assigned to current wallet in recipient list");
                  isAssignedToCurrentWallet = true;
                } else {
                  console.log("Phone is assigned to a different wallet in recipient list");
                  isAssignedToOtherWallet = true;
                  assignedWalletAddress = recipientData.wallet;
                }
              }
            } catch (err) {
              console.error(`Error checking NGO ${ngoAddress}:`, err);
            }
          }
          
          // Check if phone is registered to any wallet
          const registeredWallet = await getPhoneRegisteredWallet(contract, phoneNumber);
          console.log("Phone registered to wallet in phoneToWallet mapping:", registeredWallet);
          
          // If the phone is registered...
          if (registeredWallet) {
            // Check if it's registered to current account
            const isRegistered = registeredWallet.toLowerCase() === account.toLowerCase();
            setIsPhoneRegistered(isRegistered);
            
            // If it's assigned to current wallet in recipient list but registered to different wallet
            if (isAssignedToCurrentWallet && !isRegistered) {
              setError(`This phone number is assigned to your wallet, but registered to a different wallet (${registeredWallet.substring(0, 6)}...). You need to use the wallet assigned in the donations list.`);
            } 
            // If registered to different wallet than current
            else if (!isRegistered) {
              setError(`This phone number is registered to another wallet.`);
            }
            
            // If registered to current wallet, load claimable NGOs
            if (isRegistered) {
              await loadClaimableNGOs();
            }
          } 
          // Phone is not registered to any wallet yet
          else {
            setIsPhoneRegistered(false);
            
            // If assigned to current wallet but not yet registered
            if (isAssignedToCurrentWallet) {
              setError("This phone number is assigned to your wallet. Please verify it with OTP to claim your funds.");
            } 
            // If assigned to different wallet than current
            else if (isAssignedToOtherWallet && assignedWalletAddress) {
              setError(`This phone number is assigned to wallet ${assignedWalletAddress.substring(0, 6)}... in the donation list. Please use that wallet to claim funds.`);
            }
          }
          
        } catch (err) {
          console.error('Error checking phone registration:', err);
        } finally {
          setIsCheckingPhone(false);
        }
      }
    };
    
    checkPhoneRegistration();
  }, [contract, account, isConnected, isCorrectNetwork, phoneNumber]);

  // Load claimable NGOs
  const loadClaimableNGOs = async () => {
    if (!contract || !phoneNumber || !account) return;
    
    try {
      setIsLoadingNGOs(true);
      setClaimableNGOs([]);
      
      // Get all NGOs
      const ngoAddresses = await getAllNGOs(contract);
      console.log("All NGO addresses:", ngoAddresses);
      
      const claimable: ClaimableNGO[] = [];
      
      for (const ngoAddress of ngoAddresses) {
        try {
          console.log(`Checking NGO ${ngoAddress} for claimable funds...`);
          
          // First check if there are claimable funds
          const recipientData = await getPhoneAssignedRecipient(contract, phoneNumber, ngoAddress);
          
          if (recipientData) {
            console.log(`Phone ${phoneNumber} has funds from NGO ${ngoAddress}:`, recipientData);
            
            // Get NGO details
            const ngoDetails = await getNGODetails(contract, ngoAddress);
            console.log(`NGO details for ${ngoAddress}:`, ngoDetails);
            
            const amount = recipientData.amount;
            const claimed = recipientData.claimed;
            
            // Debug output
            console.log({
              ngoAddress,
              recipientWallet: recipientData.wallet,
              amount,
              claimed,
              currentWallet: account
            });
            
            claimable.push({
              address: ngoAddress,
              name: ngoDetails.name || 'Unknown NGO',
              description: ngoDetails.description || 'No description',
              amount,
              claimed,
              wallet: recipientData.wallet // Store the wallet the funds are assigned to
            });
          }
        } catch (err) {
          console.error(`Error checking NGO ${ngoAddress}:`, err);
        }
      }
      
      console.log("Claimable NGOs:", claimable);
      setClaimableNGOs(claimable);
    } catch (err: any) {
      console.error('Error loading claimable NGOs:', err);
      setError(err.message || 'Failed to load claimable NGOs');
    } finally {
      setIsLoadingNGOs(false);
    }
  };

  // Handle phone registration
  const handleRegisterPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !phoneNumber) return;
    
    try {
      // Generate and show mock OTP
      const mockOTPCode = Math.floor(100000 + Math.random() * 900000).toString();
      setMockOTP(mockOTPCode);
      setShowOTPVerification(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    }
  };

  // Handle OTP verification
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !phoneNumber || !otp || !account) return;
    
    try {
      setIsVerifyingOTP(true);
      setError(null);
      
      // Check if OTP matches mock OTP
      if (otp !== mockOTP) {
        throw new Error('Invalid OTP. Please try again.');
      }
      
      // Check if phone is already registered to another wallet
      const registeredWallet = await getPhoneRegisteredWallet(contract, phoneNumber);
      const needsForceRegistration = Boolean(registeredWallet && registeredWallet.toLowerCase() !== account.toLowerCase());
      
      console.log("Phone registration check:", {
        phoneNumber,
        registeredWallet,
        currentWallet: account,
        needsForceRegistration
      });
      
      // Check if this phone number is assigned to this wallet in any NGO's recipient list
      const ngoAddresses = await getAllNGOs(contract);
      let isAssignedToCurrentWallet = false;
      let isAssignedToOtherWallet = false;
      let otherWalletAddress = null;
      
      for (const ngoAddress of ngoAddresses) {
        try {
          const recipientData = await getPhoneAssignedRecipient(contract, phoneNumber, ngoAddress);
          if (recipientData) {
            console.log(`Phone ${phoneNumber} is assigned by NGO ${ngoAddress} to wallet:`, recipientData.wallet);
            
            if (recipientData.wallet.toLowerCase() === account.toLowerCase()) {
              console.log(`Phone ${phoneNumber} is assigned to current wallet by NGO ${ngoAddress}`);
              isAssignedToCurrentWallet = true;
            } else {
              console.log(`Phone ${phoneNumber} is assigned to different wallet by NGO ${ngoAddress}`);
              isAssignedToOtherWallet = true;
              otherWalletAddress = recipientData.wallet;
            }
          }
        } catch (err) {
          console.error(`Error checking NGO ${ngoAddress}:`, err);
        }
      }
      
      // If phone is assigned to a different wallet in the donation list, warn the user
      if (isAssignedToOtherWallet && !isAssignedToCurrentWallet) {
        console.warn(`This phone is assigned to another wallet (${otherWalletAddress}) in the donation list`);
        // Just a warning, but allow registration to continue - the user won't be able to claim those funds anyway
      }
      
      // Register phone even if already registered to another wallet
      setIsRegistering(true);
      
      if (needsForceRegistration) {
        console.log(`Force registering phone ${phoneNumber} to wallet ${account}`);
        setError(`This phone was previously registered to another wallet. Attempting to force-register it to your current wallet...`);
      } else {
        console.log(`Registering phone ${phoneNumber} to wallet ${account}`);
      }
      
      console.log("DEBUG - Force Registration:", {
        phoneNumber,
        currentWallet: account,
        registeredWallet,
        needsForceRegistration,
        isAssignedToCurrentWallet,
        isAssignedToOtherWallet,
        otherWalletAddress
      });
      
      // Register with force parameter if needed
      const hash = await registerPhone(contract, phoneNumber, needsForceRegistration);
      console.log('Phone registration transaction:', hash);
      
      // Wait a moment for the blockchain to update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if phone is registered
      const registered = await checkPhoneRegistered(contract, phoneNumber, account);
      console.log("After registration - phone registered to current wallet:", registered);
      
      if (!registered) {
        throw new Error("Registration failed. Please try again.");
      }
      
      setIsPhoneRegistered(registered);
      setError(null); // Clear any error messages
      
      // Load claimable NGOs
      if (registered) {
        await loadClaimableNGOs();
      }
      
      // Hide OTP verification
      setShowOTPVerification(false);
    } catch (err: any) {
      console.error('Error during OTP verification:', err);
      setError(err.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setIsVerifyingOTP(false);
      setIsRegistering(false);
    }
  };

  // Handle claim funds
  const handleClaimFunds = async (ngoAddress: string) => {
    if (!contract || !phoneNumber || !account) return;
    
    try {
      setIsClaiming(true);
      setClaimingNGOAddress(ngoAddress);
      setError(null);
      
      console.log("Claiming funds:", {
        ngoAddress,
        phoneNumber,
        currentWallet: account
      });
      
      // Check if the phone is registered to the current wallet
      const isRegistered = await checkPhoneRegistered(contract, phoneNumber, account);
      console.log("Phone registered to current wallet:", isRegistered);
      
      if (!isRegistered) {
        throw new Error("This phone number is not registered to your current wallet. Please register it first.");
      }
      
      // Check if this phone is assigned to this wallet in the recipient list
      const recipientData = await getPhoneAssignedRecipient(contract, phoneNumber, ngoAddress);
      
      // If recipient data exists, check if the wallet matches
      if (recipientData) {
        console.log("Recipient data:", recipientData);
        
        if (recipientData.wallet.toLowerCase() !== account.toLowerCase()) {
          throw new Error(`This phone number is assigned to wallet ${recipientData.wallet.substring(0, 6)}... in the donation list. You need to use that wallet to claim funds.`);
        }
        
        if (recipientData.claimed) {
          throw new Error("These funds have already been claimed.");
        }
      } else {
        throw new Error("No claimable funds found for this phone number from this NGO.");
      }
      
      // Claim funds (true for token/USDC)
      const hash = await claimFunds(contract, phoneNumber, ngoAddress, true);
      console.log("Claim transaction hash:", hash);
      setTxHash(hash);
      
      // Refresh claimable NGOs
      await loadClaimableNGOs();
    } catch (err: any) {
      console.error('Error claiming funds:', err);
      setError(err.message || 'Failed to claim funds. Please try again.');
    } finally {
      setIsClaiming(false);
      setClaimingNGOAddress(null);
    }
  };

  // Reset transaction
  const handleReset = () => {
    setTxHash(null);
    setError(null);
  };

  // Handle assignment check
  const handleCheckAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !phoneNumber) return;
    
    try {
      setIsCheckingAssignment(true);
      setError(null);
      
      // Get all NGOs to check if phone is assigned to any wallet
      const ngoAddresses = await getAllNGOs(contract);
      let foundAssignment = false;
      
      for (const ngoAddress of ngoAddresses) {
        const recipientData = await getPhoneAssignedRecipient(contract, phoneNumber, ngoAddress);
        if (recipientData) {
          console.log(`Phone ${phoneNumber} is assigned in NGO ${ngoAddress} to wallet:`, recipientData);
          foundAssignment = true;
          
          // Get NGO details
          const ngoDetails = await getNGODetails(contract, ngoAddress);
          
          setAssignmentCheckResult({
            ngoName: ngoDetails.name,
            ngoAddress: ngoAddress,
            walletAddress: recipientData.wallet,
            amount: recipientData.amount,
            claimed: recipientData.claimed
          });
          
          // Show guidance message
          if (account && recipientData.wallet.toLowerCase() !== account.toLowerCase()) {
            setError(`This phone number is assigned to wallet ${recipientData.wallet} (which is different from your current wallet: ${account}). To claim funds, you must use the wallet address that was specified by the NGO.`);
          } else if (recipientData.claimed) {
            setError(`This phone number has funds assigned, but they have already been claimed.`);
          }
          
          break;
        }
      }
      
      if (!foundAssignment) {
        setError(`No funds are assigned to this phone number by any NGO.`);
        setAssignmentCheckResult(null);
      }
      
      setShowAssignmentCheck(true);
    } catch (err: any) {
      console.error('Error checking assignment:', err);
      setError(err.message || 'Failed to check assignment.');
    } finally {
      setIsCheckingAssignment(false);
    }
  };

  // Handle reassign wallet
  const handleReassignWallet = async (ngoAddress: string) => {
    if (!contract || !phoneNumber || !account) return;
    
    try {
      setIsReassigning(true);
      setReassigningNGOAddress(ngoAddress);
      setError(null);
      
      console.log("Reassigning funds to current wallet:", {
        ngoAddress,
        phoneNumber,
        currentWallet: account
      });
      
      // Check if the phone is registered to the current wallet
      const isRegistered = await checkPhoneRegistered(contract, phoneNumber, account);
      console.log("Phone registered to current wallet:", isRegistered);
      
      if (!isRegistered) {
        throw new Error("This phone number is not registered to your current wallet. Please register it first.");
      }
      
      // Check recipient data
      const recipientData = await getPhoneAssignedRecipient(contract, phoneNumber, ngoAddress);
      
      if (!recipientData) {
        throw new Error("No funds found for this phone number from this NGO.");
      }
      
      if (recipientData.claimed) {
        throw new Error("These funds have already been claimed.");
      }
      
      if (recipientData.wallet.toLowerCase() === account.toLowerCase()) {
        setError("Funds are already assigned to your current wallet. You can claim them now.");
        return;
      }
      
      // Request reassignment
      const hash = await requestWalletReassignment(contract, phoneNumber, ngoAddress);
      console.log("Reassignment transaction hash:", hash);
      
      // Reload the NGO list to show the updated assignment
      loadClaimableNGOs();
      
      setError("Success! The funds have been reassigned to your current wallet and are now ready to claim.");
    } catch (err: any) {
      setError(err.message || 'Failed to reassign funds. Please try again.');
    } finally {
      setIsReassigning(false);
      setReassigningNGOAddress(null);
    }
  };

  // Handle direct reassignment without registration
  const handleDirectReassign = async () => {
    if (!contract || !phoneNumber || !account || !assignmentCheckResult) return;
    
    try {
      setIsReassigning(true);
      setError(null);
      
      console.log("Direct reassignment for:", {
        ngoAddress: assignmentCheckResult.ngoAddress,
        phoneNumber,
        currentWallet: account,
        assignedWallet: assignmentCheckResult.walletAddress
      });
      
      // First register the phone to the current wallet
      console.log("First registering phone to current wallet...");
      
      try {
        // Force register the phone to current wallet
        const regHash = await registerPhone(contract, phoneNumber, true);
        console.log("Phone registration successful:", regHash);
        
        // Short delay to ensure registration is processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now request reassignment
        console.log("Now requesting wallet reassignment...");
        const hash = await requestWalletReassignment(
          contract, 
          phoneNumber, 
          assignmentCheckResult.ngoAddress
        );
        
        console.log("Reassignment transaction hash:", hash);
        setError("Success! The funds have been reassigned to your current wallet. You can now claim them.");
        
        // Reload NGO data
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadClaimableNGOs();
      } catch (err: any) {
        console.error("Registration failed:", err);
        throw new Error(`Registration failed: ${err.message}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reassign funds. Please try again.');
    } finally {
      setIsReassigning(false);
    }
  };

  // Handle direct claim (simplified approach)
  const handleDirectClaim = async () => {
    if (!contract || !phoneNumber || !assignmentCheckResult) return;
    
    try {
      setIsDirectlyClaiming(true);
      setError(null);
      
      console.log("Directly claiming funds for:", {
        ngoAddress: assignmentCheckResult.ngoAddress,
        phoneNumber
      });
      
      // Call the direct claim function
      const hash = await claimDirectly(
        contract, 
        phoneNumber, 
        assignmentCheckResult.ngoAddress
      );
      
      console.log("Direct claim transaction hash:", hash);
      setError("Success! The funds have been claimed and sent to your wallet.");
      
      // Reload data after a short delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadClaimableNGOs();
    } catch (err: any) {
      console.error("Direct claim failed:", err);
      setError(err.message || 'Failed to claim funds. Please try again.');
    } finally {
      setIsDirectlyClaiming(false);
    }
  };

  if (!isCorrectNetwork) {
    return (
      <div className="claim-portal-container container">
        <h1 className="claim-portal-title">Recipient Claim Portal</h1>
        <div className="claim-instructions">
          <h2>Please connect your wallet</h2>
          <p>You need to connect your wallet and be on the Avalanche Fuji testnet to use this portal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="claim-portal-container container">
      <h1 className="claim-portal-title">Recipient Claim Portal</h1>
      
      <div className="claim-instructions">
        <h2>How to Claim Your Funds</h2>
        <p>
          Register your phone number and verify your identity to claim funds sent to you by NGOs.
        </p>
        
        <div className="claim-alert claim-alert-warning">
          <p><strong>Important:</strong> You must use the same wallet address that the NGO assigned your funds to. 
            If you're claiming from another wallet, request a wallet reassignment.
          </p>
        </div>
        
        <div className="claim-alert claim-alert-info">
          <p><strong>Tip:</strong> If registering your phone number fails, you might have already registered it with a different wallet address. 
            However, you can still request to have the funds reassigned to your current wallet address.
          </p>
        </div>
      </div>

      <div className="registration-form">
        <h2>Register Your Phone</h2>
        <p>
          Register your phone number to confirm your identity and link it to your wallet address.
        </p>
        
        <div className="phone-input-wrapper">
          <label className="phone-input-label">Phone Number (with country code)</label>
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1234567890"
          />
        </div>
        
        {showAssignmentCheck && assignmentCheckResult && (
          <div className="direct-claim">
            <h3>Simplified Claim Process</h3>
            <p>
              Skip the phone registration process and claim funds directly to your current wallet.
            </p>
            <p>
              <strong>Phone Number:</strong> {phoneNumber}<br />
              <strong>NGO:</strong> {assignmentCheckResult.ngoName}<br />
              <strong>Amount:</strong> {assignmentCheckResult.amount} USDC<br />
              <strong>Status:</strong> {assignmentCheckResult.claimed ? 'Already Claimed' : 'Available to Claim'}<br />
              <strong>Your Wallet:</strong> {account}
            </p>
            
            {!assignmentCheckResult.claimed && (
              <button
                onClick={handleDirectClaim}
                disabled={isDirectlyClaiming}
                className="claim-button"
              >
                {isDirectlyClaiming ? 'Claiming...' : 'Claim Funds Directly'}
              </button>
            )}
          </div>
        )}
        
        {showAssignmentCheck && assignmentCheckResult && !isPhoneRegistered && registeredWallet && (
          <button
            onClick={handleReassignRequest}
            disabled={isReassigning}
            className="reassign-button"
          >
            {isReassigning ? 'Requesting...' : 'Reassign to My Wallet'}
          </button>
        )}
        
        <button
          onClick={handleCheckAssignment}
          disabled={isCheckingAssignment || !phoneNumber}
          className="check-button"
        >
          {isCheckingAssignment ? 'Checking...' : 'Check If Funds Are Available'}
        </button>
        
        {error && <div className={error.includes('Success') ? 'success-message' : 'error-message'}>{error}</div>}
      </div>

      {/* Show claimed NGOs */}
      {isPhoneRegistered && claimableNGOs.length > 0 && (
        <div className="claimed-ngos">
          <h2 className="section-title">Available Funds</h2>
          <div className="ngo-cards">
            {claimableNGOs.map((ngo, index) => (
              <div key={ngo.address} className="ngo-card">
                <h3>{ngo.name}</h3>
                <div className="ngo-card-content">
                  <p>
                    <strong>Amount:</strong> 
                    <span className="ngo-amount">{ngo.amount} USDC</span>
                  </p>
                  <p>
                    <strong>Status:</strong> 
                    {ngo.claimed ? 
                      <span className="claimed-badge">Claimed</span> : 
                      <span className="pending-badge">Available</span>
                    }
                  </p>
                </div>
                
                {!ngo.claimed && (
                  <button
                    onClick={() => handleClaimFunds(ngo.address)}
                    disabled={isClaiming}
                    className="claim-button"
                  >
                    {isClaiming && claimingNGOAddress === ngo.address ? 'Claiming...' : 'Claim Funds'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimPortal; 