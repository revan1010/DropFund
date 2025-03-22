import { Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import '../styles/home.css';

const Home = () => {
  const { connect, isConnected } = useWeb3();

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              The Future of <span className="highlight">Web3</span> Fund Distribution
            </h1>
            <p className="hero-subtitle">
              Securely distribute funds to recipients using blockchain technology.
              No crypto knowledge required for recipients.
            </p>
            <div className="hero-actions">
              {!isConnected ? (
                <button className="btn-hero-primary glow" onClick={connect}>
                  Connect Wallet
                </button>
              ) : (
                <div className="hero-buttons">
                  <Link to="/bulk-donation" className="btn-hero-primary">
                    Send Funds
                  </Link>
                  <Link to="/claim-portal" className="btn-hero-secondary">
                    Claim Funds
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="hero-graphics">
            <div className="hero-image">
              <div className="cube">
                <div className="cube-face front"></div>
                <div className="cube-face back"></div>
                <div className="cube-face right"></div>
                <div className="cube-face left"></div>
                <div className="cube-face top"></div>
                <div className="cube-face bottom"></div>
              </div>
              <div className="orb"></div>
            </div>
          </div>
        </div>
        <div className="hero-background">
          <div className="grid-overlay"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features glass">
        <div className="container">
          <h2 className="section-title">Key Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon secure"></div>
              <h3>Secure Transfers</h3>
              <p>
                All transactions are secured by the Avalanche blockchain, ensuring
                transparent and tamper-proof fund distribution.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon phone"></div>
              <h3>Phone Verification</h3>
              <p>
                Recipients can claim funds using just their phone number, no need for
                technical blockchain knowledge.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon bulk"></div>
              <h3>Bulk Distribution</h3>
              <p>
                Send funds to multiple recipients in a single transaction, saving time
                and gas fees.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon token"></div>
              <h3>USDC Support</h3>
              <p>
                Distribute stable USDC tokens, providing recipients with a reliable
                store of value.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">01</div>
              <h3>Connect Wallet</h3>
              <p>Connect your Avalanche-compatible wallet to get started.</p>
            </div>
            <div className="step">
              <div className="step-number">02</div>
              <h3>Register as NGO</h3>
              <p>Register your organization to start sending funds.</p>
            </div>
            <div className="step">
              <div className="step-number">03</div>
              <h3>Add Recipients</h3>
              <p>Enter recipient phone numbers and fund amounts.</p>
            </div>
            <div className="step">
              <div className="step-number">04</div>
              <h3>Recipients Claim</h3>
              <p>Recipients verify their phone number to claim their funds.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta glass">
        <div className="container">
          <h2>Ready to Revolutionize Fund Distribution?</h2>
          <p>Start sending or claiming funds in just a few clicks.</p>
          <div className="cta-buttons">
            {!isConnected ? (
              <button className="btn-cta glow" onClick={connect}>
                Get Started
              </button>
            ) : (
              <>
                <Link to="/bulk-donation" className="btn-cta">
                  Send Funds
                </Link>
                <Link to="/claim-portal" className="btn-cta-alt">
                  Claim Funds
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home; 