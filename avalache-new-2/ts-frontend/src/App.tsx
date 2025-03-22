import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Web3Provider } from './contexts/Web3Context';
import Header from './components/Header';
import Home from './pages/Home';
import BulkDonation from './pages/BulkDonation';
import NGODashboard from './pages/NGODashboard';
import ClaimPortal from './pages/ClaimPortal';
import './App.css';

function App() {
  return (
    <div className="app">
      <Web3Provider>
        <Router>
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/bulk-donation" element={<BulkDonation />} />
              <Route path="/ngo-dashboard" element={<NGODashboard />} />
              <Route path="/claim-portal" element={<ClaimPortal />} />
            </Routes>
          </main>
        </Router>
      </Web3Provider>
    </div>
  );
}

export default App;
