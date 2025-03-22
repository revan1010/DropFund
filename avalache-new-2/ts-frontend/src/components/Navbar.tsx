import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import '../styles/navbar.css';

const Navbar = () => {
  const { connect, disconnect, account, isConnected, isCorrectNetwork, switchToFuji } = useWeb3();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Close mobile menu when changing routes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <div className="navbar-logo">
          <Link to="/">
            <span className="logo-text">Drop<span className="logo-accent">Fund</span></span>
          </Link>
        </div>
        
        <div className="navbar-menu-toggle" onClick={toggleMobileMenu}>
          <div className={`menu-icon ${mobileMenuOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        
        <div className={`navbar-links ${mobileMenuOpen ? 'open' : ''}`}>
          <Link
            to="/"
            className={location.pathname === '/' ? 'active' : ''}
          >
            Home
          </Link>
          <Link
            to="/bulk-donation"
            className={location.pathname === '/bulk-donation' ? 'active' : ''}
          >
            Send Funds
          </Link>
          <Link
            to="/claim-portal"
            className={location.pathname === '/claim-portal' ? 'active' : ''}
          >
            Claim Funds
          </Link>
        </div>
        
        <div className="navbar-actions">
          {!isConnected ? (
            <button className="btn-connect" onClick={connect}>
              <div className="btn-connect-icon">
                <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 0H2C0.9 0 0 0.9 0 2V16C0 17.1 0.9 18 2 18H18C19.1 18 20 17.1 20 16V2C20 0.9 19.1 0 18 0ZM18 16H2V2H18V16ZM7 8C7 6.34 8.34 5 10 5C11.66 5 13 6.34 13 8C13 9.66 11.66 11 10 11C8.34 11 7 9.66 7 8ZM16 14H4V13.43C4 13.28 4.04 13.13 4.12 13.01C5.03 11.65 7.31 10.54 10 10.54C12.69 10.54 14.97 11.65 15.88 13.01C15.96 13.13 16 13.28 16 13.43V14Z" fill="currentColor"/>
                </svg>
              </div>
              Connect Wallet
            </button>
          ) : !isCorrectNetwork ? (
            <button className="btn-network warning" onClick={switchToFuji}>
              <span className="network-indicator"></span>
              Switch to Fuji
            </button>
          ) : (
            <button className="btn-address" onClick={disconnect}>
              <span className="address-dot"></span>
              {shortenAddress(account || '')}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 