import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { ethers } from 'ethers';
import BulkDonationArtifact from '../contracts/BulkDonation.json';
import { CONTRACT_ADDRESS, FUJI_CHAIN_ID, FUJI_NETWORK_PARAMS } from '../contracts/config';

// Define types
interface Web3ContextType {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  contract: ethers.Contract | null;
  account: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToFuji: () => Promise<void>;
}

// Create context with default values
const Web3Context = createContext<Web3ContextType | null>(null);

// Props for the provider component
interface Web3ProviderProps {
  children: ReactNode;
}

// Context provider component
export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize metamask provider
  useEffect(() => {
    const initProvider = async () => {
      try {
        if (window.ethereum) {
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(web3Provider);
          
          // Get chain ID
          const network = await web3Provider.getNetwork();
          setChainId(Number(network.chainId));
          
          // Try to get accounts - if connected already
          try {
            const accounts = await web3Provider.listAccounts();
            if (accounts.length > 0) {
              setAccount(accounts[0].address);
              const web3Signer = await web3Provider.getSigner();
              setSigner(web3Signer);
              
              // Initialize contract
              const bulkDonationContract = new ethers.Contract(
                CONTRACT_ADDRESS,
                BulkDonationArtifact.abi,
                web3Signer
              );
              setContract(bulkDonationContract);
            }
          } catch (err) {
            console.log("No connected accounts found");
          }
        } else {
          setError("MetaMask is not installed. Please install MetaMask to use this dApp.");
        }
      } catch (err) {
        console.error("Error initializing web3:", err);
        setError("Failed to initialize web3 connection. Please refresh and try again.");
      }
    };

    initProvider();
  }, []);

  // Handle account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected
          setAccount(null);
          setSigner(null);
          setContract(null);
        } else {
          // Account changed
          setAccount(accounts[0]);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  // Handle chain changes
  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // Connect wallet function
  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Please install MetaMask to use this dApp.");
      }

      // Request accounts
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const selectedAccount = accounts[0];
      setAccount(selectedAccount);
      
      // Get signer
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      setSigner(web3Signer);
      
      // Initialize contract
      const bulkDonationContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        BulkDonationArtifact.abi,
        web3Signer
      );
      setContract(bulkDonationContract);
      
      setProvider(web3Provider);
      
      // Get current chain ID
      const network = await web3Provider.getNetwork();
      setChainId(Number(network.chainId));
      
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      setError(err.message || "Failed to connect wallet. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet (for UI purposes, real disconnection happens in MetaMask)
  const disconnect = () => {
    setAccount(null);
    setSigner(null);
    setContract(null);
  };

  // Switch to Fuji network
  const switchToFuji = async () => {
    if (!window.ethereum) return;
    
    try {
      // Try to switch to Fuji
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${FUJI_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      // If the chain is not added, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [FUJI_NETWORK_PARAMS],
        });
      } else {
        console.error("Error switching to Fuji network:", switchError);
      }
    }
  };

  // Context value
  const contextValue: Web3ContextType = {
    provider,
    signer,
    contract,
    account,
    chainId,
    isConnecting,
    error,
    isConnected: !!account,
    isCorrectNetwork: chainId === FUJI_CHAIN_ID,
    connect,
    disconnect,
    switchToFuji
  };

  return (
    <Web3Context.Provider value={contextValue}>
      {children}
    </Web3Context.Provider>
  );
};

// Custom hook to use the Web3 context
export const useWeb3 = (): Web3ContextType => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}; 