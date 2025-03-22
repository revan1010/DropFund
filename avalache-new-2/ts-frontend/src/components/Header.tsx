import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';

const Header = () => {
  const { 
    account, 
    isConnected, 
    isCorrectNetwork, 
    connect, 
    disconnect, 
    switchToFuji,
    isConnecting,
    error
  } = useWeb3();
  
  const [showNetworkError, setShowNetworkError] = useState(false);
  const location = useLocation();
  
  // Format the account address for display
  const formatAddress = (address: string): string => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Handle connect button click
  const handleConnect = async () => {
    if (isConnected) {
      disconnect();
    } else {
      await connect();
      
      // Show network error if necessary
      if (isConnected && !isCorrectNetwork) {
        setShowNetworkError(true);
      }
    }
  };
  
  // Handle switch network button click
  const handleSwitchNetwork = async () => {
    await switchToFuji();
    setShowNetworkError(false);
  };
  
  const isActive = (path: string) => {
    return location.pathname === path ? 'active' : '';
  };
  
  return (
    <header className="header">
      <div className="container">
        <div className="logo">
          <h1>Bulk Donation dApp</h1>
        </div>
        
        <nav className="navigation">
          <ul>
            <li className={isActive('/')}>
              <Link to="/">Home</Link>
            </li>
            <li className={isActive('/bulk-donation')}>
              <Link to="/bulk-donation">Bulk Donation</Link>
            </li>
            <li className={isActive('/ngo-dashboard')}>
              <Link to="/ngo-dashboard">NGO Dashboard</Link>
            </li>
            <li className={isActive('/claim-portal')}>
              <Link to="/claim-portal">Claim Portal</Link>
            </li>
          </ul>
        </nav>
        
        <div className="wallet-info">
          {isConnected && (
            <div className="account-info">
              <span className="account-address">{formatAddress(account || '')}</span>
            </div>
          )}
          
          <button 
            className={`connect-button ${isConnected ? 'connected' : ''}`}
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect Wallet'}
          </button>
          
          {isConnected && !isCorrectNetwork && (
            <button 
              className="switch-network-button"
              onClick={handleSwitchNetwork}
            >
              Switch to Fuji
            </button>
          )}
        </div>
      </div>
      
      {/* Network Error Message */}
      {showNetworkError && (
        <div className="network-error">
          <p>Please switch to the Avalanche Fuji Testnet to use this dApp.</p>
          <button onClick={handleSwitchNetwork}>Switch Network</button>
          <button onClick={() => setShowNetworkError(false)}>Close</button>
        </div>
      )}
      
      {/* Connection Error Message */}
      {error && (
        <div className="connection-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      )}
    </header>
  );
};

export default Header; 