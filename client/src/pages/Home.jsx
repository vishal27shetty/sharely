import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShareNodes, 
  faArrowRight, 
  faShieldAlt, 
  faBolt, 
  faLink,
  faLock,
  faServer
} from '@fortawesome/free-solid-svg-icons';
import '../styles/Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    // Trigger entry animations after component mounts
    setTimeout(() => {
      setShowAnimation(true);
    }, 100);
  }, []);

  const createNewRoom = async () => {
    setIsLoading(true);
    // Simulate loading
    setTimeout(() => {
      // generate 4-digit room code
      const code = String(Math.floor(1000 + Math.random() * 9000));
      navigate(`/room/${code}`);
      setIsLoading(false);
    }, 800);
  };

  const joinRoom = () => {
    if (joinCode.length < 4) return;
    navigate(`/room/${joinCode}`);
  };

  return (
    <div className="home-container">
      <div className="home-gradient-bg"></div>
      
      <header className="home-header">
        <div className="home-logo">
          <FontAwesomeIcon icon={faShareNodes} className="logo-icon" />
          <h1>Sharely</h1>
        </div>
        <nav className="home-nav">
          <a href="#features" className="nav-link">Features</a>
          <a href="#how-it-works" className="nav-link">How it works</a>
          <a href="#about" className="nav-link">About</a>
        </nav>
      </header>

      <main className="home-content">
        <section className={`hero-section ${showAnimation ? 'animate' : ''}`}>
          <div className="hero-content">
            <h1 className="hero-title">
              Effortless, Secure
              <span className="hero-highlight"> P2P </span>
              File Sharing
            </h1>
            <div className="hero-divider"></div>
            <p className="hero-description">
              Instantly share files between devices with zero setup. 
              No uploads. No accounts. Just pure, encrypted peer-to-peer magic.
            </p>
            <button 
              className={`cta-button ${isLoading ? 'loading' : ''}`} 
              onClick={createNewRoom}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  <span>Creating Room...</span>
                </>
              ) : (
                <>
                  <span>Start Sharing</span>
                  <FontAwesomeIcon icon={faArrowRight} />
                </>
              )}
            </button>
            <div className="join-section">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0,4))}
                className="join-input"
                placeholder={`Enter code`}
                style={{ fontSize: '0.90rem' }}
                maxLength={4}
              />
              <button
                className="join-button"
                onClick={joinRoom}
                disabled={joinCode.length < 4}
              >
                Join Room
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="sharing-illustration">
              <div className="device device-1">
                <div className="device-header"></div>
                <div className="device-content">
                  <div className="file-block"></div>
                  <div className="file-block"></div>
                </div>
              </div>
              <div className="transfer-path">
                <div className="transfer-packet"></div>
                <div className="transfer-packet packet-2"></div>
              </div>
              <div className="device device-2">
                <div className="device-header"></div>
                <div className="device-content">
                  <div className="file-block"></div>
                  <div className="file-block"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="features-section">
          <h2 className="section-title">Why Choose Sharely</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faBolt} />
              </div>
              <h3>Blazing Fast</h3>
              <p>Direct device-to-device transfer means no server bottlenecks, resulting in the fastest possible file sharing experience.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faLock} />
              </div>
              <h3>End-to-End Secure</h3>
              <p>All transfers are encrypted, private, and secure. Only you and your intended recipients can access the shared files.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faLink} />
              </div>
              <h3>Simple Sharing</h3>
              <p>No signups, no installs. Just share a link and start transferring files with anyone, anywhere in the world.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faServer} />
              </div>
              <h3>No Size Limits</h3>
              <p>Transfer files of any size without restrictions. Perfect for large files that would time out on traditional services.</p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="how-it-works-section">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Create a Room</h3>
              <p>Click "Start Sharing" to generate a unique, secure room for your file transfer session.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Share Your Link</h3>
              <p>Copy your room link and send it to the people you want to share files with.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Transfer Files</h3>
              <p>Drag and drop files to instantly begin secure peer-to-peer transfers.</p>
            </div>
          </div>
        </section>

        <section id="about" className="about-section">
          <div className="about-content">
            <h2 className="section-title">About Sharely</h2>
            <p>
              Sharely was created to make file sharing simple, secure, and hassle-free. 
              Using WebRTC technology, we enable direct peer-to-peer connections between 
              devices, eliminating the need for cloud storage or server uploads.
            </p>
            <p>
              Your files never touch our servers. All transfers are encrypted and direct, 
              ensuring your data stays private and secure.
            </p>
          </div>
          <div className="security-badge">
            <FontAwesomeIcon icon={faShieldAlt} className="shield-icon" />
            <span>End-to-End Encryption</span>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <FontAwesomeIcon icon={faShareNodes} className="logo-icon" />
            <span>Sharely</span>
          </div>
          <p className="footer-tagline">Secure, Peer to Peer File Transfer</p>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it Works</a>
            <a href="#about">About</a>
            <a href="#privacy">Privacy</a>
          </div>
        </div>
        <div className="footer-copyright">
          {new Date().getFullYear()} Sharely. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Home;