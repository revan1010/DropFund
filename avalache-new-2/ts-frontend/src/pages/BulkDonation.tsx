import { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { registerNGO, sendBulkDonations, getRecipientsCount, updateRecipientWallet } from '../services/contractService';
import { ethers } from 'ethers';
import Papa from 'papaparse';
import '../styles/bulk-donation.css';

// Constants for ethers
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const parseUnits = (value: string, decimals: number) => {
  // Simple function to parse units since ethers v6 changed the API
  const amount = parseFloat(value);
  const factor = Math.pow(10, decimals);
  return Math.floor(amount * factor).toString();
};

interface Recipient {
  phone: string;
  amount: string;
  wallet?: string;
}

const BulkDonation = () => {
  const { contract, account, isConnected, isCorrectNetwork } = useWeb3();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // NGO Registration state
  const [ngoName, setNgoName] = useState<string>('');
  const [ngoDescription, setNgoDescription] = useState<string>('');
  const [isNGORegistered, setIsNGORegistered] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  
  // Recipients state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isAddingRecipients, setIsAddingRecipients] = useState<boolean>(false);
  const [recipientsCount, setRecipientsCount] = useState<number>(0);
  
  // Wallet reassignment state
  const [phoneToReassign, setPhoneToReassign] = useState<string>('');
  const [newWallet, setNewWallet] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);
  
  // File processing state
  const [fileName, setFileName] = useState<string>('');
  
  // Status and error handling
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Check if user is connected and on the right network
  const isReady = isConnected && isCorrectNetwork && !!contract;
  
  // Handle NGO registration
  const handleRegisterNGO = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contract || !ngoName || !ngoDescription) return;
    
    try {
      setIsRegistering(true);
      setError(null);
      setSuccess(null);
      
      const result = await registerNGO(contract, ngoName, ngoDescription);
      console.log("NGO registration result:", result);
      
      setIsNGORegistered(true);
      setSuccess(`NGO registered successfully: ${ngoName}`);
      
      // Load recipients count after registration
      loadRecipientsCount();
    } catch (err: any) {
      console.error("NGO registration failed:", err);
      setError(err.message || 'Failed to register NGO. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };
  
  // Handle adding recipients in bulk
  const handleAddRecipients = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contract || recipients.length === 0) return;
    
    try {
      setIsAddingRecipients(true);
      setError(null);
      setSuccess(null);
      
      // Convert recipients to DonationEntry format
      const entries = recipients.map(r => ({
        phoneNumber: r.phone,
        walletAddress: r.wallet || ZERO_ADDRESS,
        amount: r.amount
      }));
      
      console.log("Adding recipients:", entries);
      
      const result = await sendBulkDonations(contract, entries);
      console.log("Add recipients result:", result);
      
      setSuccess(`Successfully added ${recipients.length} recipients`);
      setRecipients([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Reload recipients count after adding
      loadRecipientsCount();
    } catch (err: any) {
      console.error("Adding recipients failed:", err);
      setError(err.message || 'Failed to add recipients. Please try again.');
    } finally {
      setIsAddingRecipients(false);
    }
  };
  
  // Handle wallet reassignment
  const handleReassignWallet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contract || !phoneToReassign || !newWallet) return;
    
    try {
      setIsReassigning(true);
      setError(null);
      setSuccess(null);
      
      // Check if wallet address is valid
      if (!ethers.isAddress(newWallet)) {
        throw new Error("Invalid wallet address");
      }
      
      const result = await updateRecipientWallet(contract, phoneToReassign, newWallet);
      console.log("Wallet reassignment result:", result);
      
      setSuccess(`Successfully reassigned wallet for phone number ${phoneToReassign}`);
      setPhoneToReassign('');
      setNewWallet('');
    } catch (err: any) {
      console.error("Wallet reassignment failed:", err);
      setError(err.message || 'Failed to reassign wallet. Please try again.');
    } finally {
      setIsReassigning(false);
    }
  };
  
  // Handle CSV file upload for recipients
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setError(null);
    setSuccess(null);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }
        
        try {
          const parsedRecipients = results.data.map((row: any) => ({
            phone: row.phone || '',
            amount: row.amount || '0',
            wallet: row.wallet || undefined
          }));
          
          // Validate recipient data
          const validRecipients = parsedRecipients.filter(r => {
            const isValid = r.phone && r.amount && parseFloat(r.amount) > 0;
            if (!isValid) {
              console.warn("Skipping invalid recipient:", r);
            }
            return isValid;
          });
          
          console.log("Parsed recipients:", validRecipients);
          setRecipients(validRecipients);
          
          if (validRecipients.length === 0) {
            setError('No valid recipients found in CSV');
          } else if (validRecipients.length !== parsedRecipients.length) {
            setSuccess(`Loaded ${validRecipients.length} valid recipients (${parsedRecipients.length - validRecipients.length} invalid entries skipped)`);
          } else {
            setSuccess(`Loaded ${validRecipients.length} recipients from CSV`);
          }
        } catch (err: any) {
          console.error("Error processing CSV:", err);
          setError(err.message || 'Failed to process CSV file');
        }
      }
    });
  };
  
  // Load the count of recipients added by this NGO
  const loadRecipientsCount = async () => {
    if (!contract || !isNGORegistered) return;
    
    try {
      const count = await getRecipientsCount(contract);
      setRecipientsCount(count);
    } catch (err: any) {
      console.error("Error loading recipients count:", err);
    }
  };
  
  // Check NGO registration status on component mount
  useEffect(() => {
    if (contract && account) {
      // For now, just check if we have recipients count as a proxy for registration
      loadRecipientsCount();
    }
  }, [contract, account]);
  
  // Set NGO as registered if we have recipients
  useEffect(() => {
    if (recipientsCount > 0) {
      setIsNGORegistered(true);
    }
  }, [recipientsCount]);
  
  if (!isReady) {
    return (
      <div className="bulk-donation-container container">
        <h1 className="page-title">Bulk Donation Portal</h1>
        <div className="connect-message">
          <h2>Please connect your wallet</h2>
          <p>You need to connect your wallet and be on the Avalanche Fuji testnet to use this portal.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bulk-donation-container container">
      <h1 className="page-title">Bulk Donation Portal</h1>
      
      <div className="instructions">
        <h2>How to Use This Portal</h2>
        <p>
          This portal allows NGOs to register and distribute funds to multiple recipients at once.
          Recipients can then claim their funds using their phone number.
        </p>
        
        <div className="alert alert-info">
          <p>
            <strong>Note:</strong> This is a testnet application. You'll need testnet USDC to distribute funds.
          </p>
        </div>
      </div>
      
      {(error || success) && (
        <div className={`notification ${error ? 'notification-error' : 'notification-success'}`}>
          <p>{error || success}</p>
        </div>
      )}
      
      {!isNGORegistered ? (
        <div className="card">
          <div className="card-header">
            <h2>Register as an NGO</h2>
            <p>Register your organization to start distributing funds</p>
          </div>
          
          <form onSubmit={handleRegisterNGO} className="form">
            <div className="form-group">
              <label htmlFor="ngoName">Organization Name</label>
              <input
                type="text"
                id="ngoName"
                placeholder="Enter your organization name"
                value={ngoName}
                onChange={(e) => setNgoName(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="ngoDescription">Description</label>
              <textarea
                id="ngoDescription"
                placeholder="Describe your organization and its mission"
                value={ngoDescription}
                onChange={(e) => setNgoDescription(e.target.value)}
                required
              ></textarea>
            </div>
            
            <button
              type="submit"
              disabled={isRegistering || !ngoName || !ngoDescription}
              className="btn btn-primary"
            >
              {isRegistering ? 'Registering...' : 'Register NGO'}
            </button>
          </form>
        </div>
      ) : (
        <div className="ngo-dashboard">
          <div className="card">
            <div className="card-header">
              <h2>Add Recipients</h2>
              <p>Upload a CSV file with recipient details</p>
              {recipientsCount > 0 && (
                <div className="stats">
                  <span className="stat">
                    <strong>Total Recipients:</strong> {recipientsCount}
                  </span>
                </div>
              )}
            </div>
            
            <div className="file-upload">
              <p className="upload-instructions">
                CSV should have columns: <code>phone</code>, <code>amount</code>, and optionally <code>wallet</code>
              </p>
              
              <label htmlFor="csv-file" className="file-input-label">
                <div className="file-icon">📁</div>
                <div className="file-info">
                  <span className="file-text">
                    {fileName ? fileName : 'Choose CSV file or drag it here'}
                  </span>
                </div>
              </label>
              
              <input
                type="file"
                id="csv-file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileUpload}
                className="file-input"
              />
            </div>
            
            {recipients.length > 0 && (
              <>
                <div className="recipients-preview">
                  <h3>Recipients Preview ({recipients.length})</h3>
                  <div className="table-container">
                    <table className="recipients-table">
                      <thead>
                        <tr>
                          <th>Phone</th>
                          <th>Amount (USDC)</th>
                          <th>Wallet (Optional)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.slice(0, 5).map((recipient, index) => (
                          <tr key={index}>
                            <td>{recipient.phone}</td>
                            <td>{recipient.amount}</td>
                            <td>{recipient.wallet || '-'}</td>
                          </tr>
                        ))}
                        {recipients.length > 5 && (
                          <tr>
                            <td colSpan={3} className="more-entries">
                              ... and {recipients.length - 5} more entries
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <form onSubmit={handleAddRecipients} className="form">
                  <button
                    type="submit"
                    disabled={isAddingRecipients || recipients.length === 0}
                    className="btn btn-primary"
                  >
                    {isAddingRecipients ? 'Processing...' : `Fund ${recipients.length} Recipients`}
                  </button>
                </form>
              </>
            )}
          </div>
          
          <div className="card">
            <div className="card-header">
              <h2>Update Recipient Wallet</h2>
              <p>Change the wallet address assigned to a phone number</p>
            </div>
            
            <form onSubmit={handleReassignWallet} className="form">
              <div className="form-group">
                <label htmlFor="phoneToReassign">Phone Number</label>
                <input
                  type="text"
                  id="phoneToReassign"
                  placeholder="+1234567890"
                  value={phoneToReassign}
                  onChange={(e) => setPhoneToReassign(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="newWallet">New Wallet Address</label>
                <input
                  type="text"
                  id="newWallet"
                  placeholder="0x..."
                  value={newWallet}
                  onChange={(e) => setNewWallet(e.target.value)}
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isReassigning || !phoneToReassign || !newWallet}
                className="btn btn-secondary"
              >
                {isReassigning ? 'Updating...' : 'Update Wallet'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkDonation; 