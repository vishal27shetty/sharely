import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShareNodes, faArrowLeft, faCopy, faUsers, faFile, faLink, faFileUpload, faCloudDownload } from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import '../styles/Room.css';

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef();
  const fileInputRef = useRef(null);
  const [peers, setPeers] = useState({});
  const [files, setFiles] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDropActive, setIsDropActive] = useState(false);

  useEffect(() => {
    socketRef.current = io('http://localhost:3000', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    const peerId = uuidv4();
    setupSocketEvents(peerId);
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId]);

  useEffect(() => {
    // Handle drag and drop events
    const handleDragOver = (e) => {
      e.preventDefault();
      setIsDropActive(true);
    };

    const handleDragLeave = () => {
      setIsDropActive(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setIsDropActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  const setupSocketEvents = (myPeerId) => {
    const socket = socketRef.current;
    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-room', roomId, myPeerId);
      showNotification('Connected to server', 'success');
    });
    socket.on('disconnect', () => {
      setIsConnected(false);
      showNotification('Disconnected from server', 'error');
    });
    socket.on('connect_error', (error) => {
      showNotification('Connection error: ' + error.message, 'error');
    });
    socket.on('room-users', (users) => {
      const newPeers = { ...peers };
      users.forEach(user => {
        if (!newPeers[user.id]) {
          newPeers[user.id] = {
            id: user.id,
            peerId: user.peerId,
            name: `User-${user.peerId.substring(0, 4)}`,
            connection: null
          };
        }
      });
      setPeers(newPeers);
      if (users.length > 0) {
        showNotification(`Connected to room with ${users.length} other users`);
      }
    });
    socket.on('user-connected', (user) => {
      setPeers(prev => {
        const newPeers = { ...prev };
        if (!newPeers[user.id]) {
          newPeers[user.id] = {
            id: user.id,
            peerId: user.peerId,
            name: `User-${user.peerId.substring(0, 4)}`,
            connection: null
          };
        }
        return newPeers;
      });
      showNotification('New user connected', 'success');
    });
    socket.on('user-disconnected', (userId) => {
      setPeers(prev => {
        const newPeers = { ...prev };
        if (newPeers[userId]) {
          delete newPeers[userId];
        }
        return newPeers;
      });
      showNotification('A user disconnected', 'warning');
    });

    // File transfer events
    socket.on('file-start', (fileInfo) => {
      setFiles(prev => ({
        ...prev,
        [fileInfo.id]: {
          ...fileInfo,
          progress: 0,
          status: 'Receiving...'
        }
      }));
      showNotification(`Receiving file: ${fileInfo.name}`, 'info');
    });

    socket.on('file-progress', (data) => {
      setFiles(prev => ({
        ...prev,
        [data.fileId]: {
          ...prev[data.fileId],
          progress: data.progress,
        }
      }));
    });

    socket.on('file-complete', (fileId) => {
      setFiles(prev => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          progress: 100,
          status: 'Completed'
        }
      }));
      showNotification(`File transfer complete!`, 'success');
    });
  };

  const showNotification = (message, type = 'info') => {
    const id = uuidv4();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    showNotification('Room link copied!', 'success');
    setTimeout(() => setCopied(false), 1400);
  };

  const handleFileInputClick = () => {
    fileInputRef.current.click();
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    // Add new file to the list
    const fileId = uuidv4();
    setFiles(prev => ({
      ...prev,
      [fileId]: {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'Ready to send',
        progress: 0
      }
    }));
    showNotification(`File selected: ${file.name}`, 'success');
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const sendFile = (fileId) => {
    // Implementation would depend on your P2P library
    const fileToSend = files[fileId];
    if (fileToSend) {
      setFiles(prev => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          status: 'Sending...',
        }
      }));
      
      // Mock a file transfer with progress updates
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setFiles(prev => ({
          ...prev,
          [fileId]: {
            ...prev[fileId],
            progress,
            status: progress < 100 ? 'Sending...' : 'Completed'
          }
        }));
        
        if (progress >= 100) {
          clearInterval(interval);
          showNotification(`File sent successfully!`, 'success');
        }
      }, 500);
    }
  };

  return (
    <div className={`room-container ${isDropActive ? 'drop-active' : ''}`}>
      <div className="room-gradient-bg"></div>
      
      <header className="room-header">
        <div className="room-header-left">
          <button className="back-button" onClick={() => navigate('/')}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div className="room-logo">
            <FontAwesomeIcon icon={faShareNodes} className="logo-icon" />
            <h1>Sharely</h1>
          </div>
        </div>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <main className="room-content">
        <section className="room-info-section">
          <div className="room-info-card">
            <div className="room-id-container">
              <h2>Room ID</h2>
              <div className="room-id-display">
                <FontAwesomeIcon icon={faLink} className="room-id-icon" />
                <span className="room-id-text">{roomId}</span>
              </div>
            </div>
            <button 
              className={`copy-link-button ${copied ? 'copied' : ''}`}
              onClick={copyRoomLink}
              ref={linkRef}
            >
              <FontAwesomeIcon icon={faCopy} />
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </section>

        <section className="room-main-section">
          <div className="room-cards-container">
            <div className="room-card peers-card">
              <div className="card-header">
                <FontAwesomeIcon icon={faUsers} className="card-icon" />
                <h2>Connected Peers</h2>
                <span className="peers-count">{Object.keys(peers).length}</span>
              </div>
              <div className="card-content">
                {Object.keys(peers).length === 0 ? (
                  <div className="empty-state">
                    <p>No peers connected yet</p>
                    <p className="empty-state-subtitle">Share your room link to invite others</p>
                  </div>
                ) : (
                  <ul className="peers-list">
                    {Object.values(peers).map(peer => (
                      <li key={peer.id} className="peer-item">
                        <div className="peer-avatar">
                          <span>{peer.name.charAt(0)}</span>
                        </div>
                        <div className="peer-info">
                          <span className="peer-name">{peer.name}</span>
                          <span className="peer-status">Connected</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="room-card files-card">
              <div className="card-header">
                <FontAwesomeIcon icon={faFile} className="card-icon" />
                <h2>File Transfers</h2>
                <button className="file-upload-button" onClick={handleFileInputClick}>
                  <FontAwesomeIcon icon={faFileUpload} />
                  <span>Upload</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload}
                />
              </div>
              <div className="card-content">
                {Object.keys(files).length === 0 ? (
                  <div className="empty-state">
                    <p>No files shared yet</p>
                    <p className="empty-state-subtitle">Drop files here or click upload</p>
                  </div>
                ) : (
                  <ul className="files-list">
                    {Object.values(files).map(file => (
                      <li key={file.id} className="file-item">
                        <div className="file-icon">
                          <FontAwesomeIcon icon={faFile} />
                        </div>
                        <div className="file-info">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">{(file.size / 1024).toFixed(2)} KB</span>
                          <div className="file-progress">
                            <div 
                              className="file-progress-bar" 
                              style={{ width: `${file.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="file-actions">
                          {file.status === 'Ready to send' && (
                            <button className="send-file-button" onClick={() => sendFile(file.id)}>
                              <FontAwesomeIcon icon={faCloudDownload} />
                            </button>
                          )}
                          <span className="file-status">{file.status}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                
                <div className="drop-overlay">
                  <div className="drop-message">
                    <FontAwesomeIcon icon={faFileUpload} className="drop-icon" />
                    <span>Drop files to share</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {notifications.length > 0 && (
          <div className="notifications-container">
            {notifications.map(notification => (
              <div key={notification.id} className={`notification ${notification.type}`}>
                {notification.message}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="room-footer">
        <p>Sharely · Secure, Peer to Peer File Transfer</p>
      </footer>
    </div>
  );
};

export default Room;