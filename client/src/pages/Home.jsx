import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShareNodes, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import '../styles/Home.css';
import { v4 as uuidv4 } from 'uuid';

const Home = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const createNewRoom = async () => {
    setIsCreating(true);
    try {
      // Generate a room ID directly on the client side
      const roomId = uuidv4();
      navigate(`/room/${roomId}`);
    } catch (error) {
      console.error('Error creating room:', error);
      setIsCreating(false);
    }
  };

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="logo">
          <FontAwesomeIcon icon={faShareNodes} className="logo-icon" />
          <h1>ShareIt</h1>
        </div>
        
        <h2>Instant P2P File Sharing</h2>
        <p className="description">
          Share files directly between devices without uploading to a server.
          Your files are transferred peer-to-peer with end-to-end encryption.
        </p>
        
        <button 
          className="create-room-btn" 
          onClick={createNewRoom}
          disabled={isCreating}
        >
          {isCreating ? 'Creating Room...' : (
            <>
              Start Sharing <FontAwesomeIcon icon={faArrowRight} />
            </>
          )}
        </button>
        
        <div className="features">
          <div className="feature">
            <h3>Secure</h3>
            <p>Direct device-to-device transfer with no server storage</p>
          </div>
          <div className="feature">
            <h3>Simple</h3>
            <p>No account or installation required</p>
          </div>
          <div className="feature">
            <h3>Fast</h3>
            <p>Transfer at the maximum speed your connection allows</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
