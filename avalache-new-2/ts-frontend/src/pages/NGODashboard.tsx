import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import { checkNGORegistration } from '../services/contractService';

const NGODashboard = () => {
  const { isConnected, isCorrectNetwork, contract, account, switchToFuji } = useWeb3();
  const navigate = useNavigate();

  const [isNGO, setIsNGO] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [ngoData, setNGOData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if user is connected and on the right network
  useEffect(() => {
    if (!isConnected) {
      navigate('/');
    }
  }, [isConnected, navigate]);

  // Check if user is registered as NGO and fetch NGO data
  useEffect(() => {
    const checkNGOStatus = async () => {
      if (contract && account && isConnected && isCorrectNetwork) {
        try {
          setIsLoading(true);
          setError(null);
          
          // Check if registered as NGO
          const ngoStatus = await checkNGORegistration(contract, account);
          setIsNGO(ngoStatus);
          
          // If registered, fetch NGO data
          if (ngoStatus) {
            const data = await contract.ngos(account);
            setNGOData({
              name: data.name,
              description: data.description,
              isRegistered: data.isRegistered,
              // Add any other relevant data from your contract
            });
          }
        } catch (err: any) {
          console.error('Error checking NGO status:', err);
          setError(err.message || 'Failed to load NGO data');
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    checkNGOStatus();
  }, [contract, account, isConnected, isCorrectNetwork]);

  if (!isCorrectNetwork) {
    return (
      <div className="ngo-dashboard">
        <h1>NGO Dashboard</h1>
        <div className="network-error">
          <p>Please switch to the Avalanche Fuji Testnet to use this feature.</p>
          <button onClick={switchToFuji}>Switch Network</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="ngo-dashboard">
        <h1>NGO Dashboard</h1>
        <div className="loading">
          <p>Loading NGO information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ngo-dashboard">
      <h1>NGO Dashboard</h1>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {!isNGO ? (
        <div className="not-registered">
          <h2>Not Registered</h2>
          <p>
            You are not registered as an NGO yet. 
            Please go to the <a href="/bulk-donation">Bulk Donation</a> page to register.
          </p>
        </div>
      ) : (
        <div className="ngo-profile">
          <h2>NGO Profile</h2>
          <div className="ngo-card">
            <div className="ngo-details">
              <h3>{ngoData?.name || 'NGO Name'}</h3>
              <p className="ngo-description">{ngoData?.description || 'No description available'}</p>
              <p className="ngo-status">
                <span className="status-indicator registered"></span>
                Registered
              </p>
            </div>
          </div>
          
          <div className="ngo-actions">
            <button onClick={() => navigate('/bulk-donation')}>
              Make Bulk Donation
            </button>
          </div>
          
          {/* In future versions, you can add donation history here */}
          <div className="donation-history">
            <h3>Donation History</h3>
            <p>Donation history will be available in future updates.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NGODashboard; 