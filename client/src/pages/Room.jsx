import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShareNodes, faCopy, faPlus, faUsers, 
  faExchangeAlt, faCloudUploadAlt, faPaperPlane,
  faFile, faCheck, faTimes, faBan, faInfoCircle,
  faDownload, faImage, faVideo, faMusic
} from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import '../styles/Room.css';

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  // Refs
  const socketRef = useRef();
  const fileInputRef = useRef(null);
  
  // State
  const [peers, setPeers] = useState({});
  const [files, setFiles] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Initialize connection
  useEffect(() => {
    // Initialize Socket.io
    console.log('Connecting to socket server...');
    socketRef.current = io('http://localhost:3000', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    // Initialize with a unique peer ID
    const peerId = uuidv4();
    console.log('My peer ID:', peerId);
    
    // Setup socket events
    setupSocketEvents(peerId);
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId]);
  
  // Set up Socket.io event listeners
  const setupSocketEvents = (myPeerId) => {
    const socket = socketRef.current;
    
    socket.on('connect', () => {
      console.log('Connected to server with socket ID:', socket.id);
      setIsConnected(true);
      showNotification('Connected to server');
      
      // Join the room
      console.log('Joining room:', roomId, 'with peer ID:', myPeerId);
      socket.emit('join-room', roomId, myPeerId);
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      showNotification('Disconnected from server', 'error');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      showNotification('Connection error: ' + error.message, 'error');
    });
    
    // When we receive the list of users in the room
    socket.on('room-users', (users) => {
      console.log('Room users received:', users);
      
      if (users.length === 0) {
        console.log('No other users in the room');
        return;
      }
      
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
    
    // When a new user connects to the room
    socket.on('user-connected', (user) => {
      console.log('User connected:', user);
      
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
      
      showNotification('New user connected');
    });
    
    // When a user disconnects from the room
    socket.on('user-disconnected', (userId) => {
      console.log('User disconnected:', userId);
      
      setPeers(prev => {
        const newPeers = { ...prev };
        if (newPeers[userId]) {
          delete newPeers[userId];
        }
        return newPeers;
      });
      
      showNotification('User disconnected');
    });
    
    // Handle file transfer requests
    socket.on('file-request', ({ from, fileInfo }) => {
      console.log('File request received:', fileInfo);
      const fileId = uuidv4();
      
      // Create a new file entry
      setFiles(prev => {
        const newFiles = { ...prev };
        newFiles[fileId] = {
          id: fileId,
          from: from,
          name: fileInfo.name,
          size: fileInfo.size,
          type: fileInfo.type,
          status: 'pending',
          direction: 'incoming'
        };
        return newFiles;
      });
      
      showNotification(`${peers[from]?.name || 'Someone'} wants to send you "${fileInfo.name}" (${formatFileSize(fileInfo.size)})`);
    });
    
    // Handle file transfer response
    socket.on('file-response', ({ from, accepted, fileId }) => {
      console.log(`File ${accepted ? 'accepted' : 'rejected'} by ${from}`);
      
      if (accepted) {
        // Find the file and send it
        setFiles(prev => {
          const newFiles = { ...prev };
          const file = Object.values(newFiles).find(f => 
            f.to === from && f.status === 'waiting');
          
          if (file) {
            file.status = 'transferring';
            sendFile(file, from);
          }
          
          return newFiles;
        });
      } else {
        // Update file status to rejected
        setFiles(prev => {
          const newFiles = { ...prev };
          const file = Object.values(newFiles).find(f => 
            f.to === from && f.status === 'waiting');
          
          if (file) {
            file.status = 'rejected';
          }
          
          return newFiles;
        });
        
        showNotification('File transfer rejected by recipient', 'error');
      }
    });
    
    // Handle file transfer (direct, no chunking)
    socket.on('file-transfer', ({ from, fileData, fileName, fileType }) => {
      console.log(`Received file ${fileName} from ${from}`);
      
      try {
        // Create a blob from the base64 data
        const byteCharacters = atob(fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: fileType });
        
        // Create a download URL
        const downloadUrl = URL.createObjectURL(blob);
        
        // Find the file entry and update it
        setFiles(prev => {
          const newFiles = { ...prev };
          const fileId = Object.keys(newFiles).find(id => 
            newFiles[id].from === from && 
            newFiles[id].name === fileName && 
            newFiles[id].status === 'accepted');
          
          if (fileId) {
            newFiles[fileId].status = 'completed';
            newFiles[fileId].downloadUrl = downloadUrl;
          } else {
            // Create a new file entry if one doesn't exist
            const newFileId = uuidv4();
            newFiles[newFileId] = {
              id: newFileId,
              from: from,
              name: fileName,
              type: fileType,
              status: 'completed',
              direction: 'incoming',
              downloadUrl: downloadUrl
            };
          }
          
          return newFiles;
        });
        
        showNotification(`File "${fileName}" received successfully. Click to download.`, 'success');
      } catch (error) {
        console.error('Error processing file:', error);
        showNotification(`File processing failed: ${error.message}`, 'error');
      }
    });
  };
  
  // Send a file directly (no chunking)
  const sendFile = (file, recipientId) => {
    if (!file || !file.fileObject) {
      showNotification('No file to send', 'error');
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
      // Get base64 data (remove the data:*/*;base64, prefix)
      const base64data = e.target.result.split(',')[1];
      
      // Send the entire file at once
      socketRef.current.emit('file-transfer', {
        to: recipientId,
        fileData: base64data,
        fileName: file.name,
        fileType: file.type
      });
      
      // Update file status
      setFiles(prev => {
        const newFiles = { ...prev };
        if (newFiles[file.id]) {
          newFiles[file.id].status = 'completed';
        }
        return newFiles;
      });
      
      showNotification(`File "${file.name}" sent successfully`, 'success');
    };
    
    reader.onerror = function(error) {
      console.error('Error reading file:', error);
      showNotification('Error reading file', 'error');
      
      // Update file status
      setFiles(prev => {
        const newFiles = { ...prev };
        if (newFiles[file.id]) {
          newFiles[file.id].status = 'failed';
        }
        return newFiles;
      });
    };
    
    // Read the file as data URL (base64)
    reader.readAsDataURL(file.fileObject);
  };
  
  // Download a completed file
  const downloadFile = (fileId) => {
    const file = files[fileId];
    if (!file || file.status !== 'completed' || !file.downloadUrl) {
      showNotification('File is not ready for download', 'error');
      return;
    }
    
    try {
      // Create and trigger download link
      const a = document.createElement('a');
      a.href = file.downloadUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      showNotification(`Downloading ${file.name}`, 'success');
    } catch (error) {
      console.error('Download error:', error);
      showNotification(`Download failed: ${error.message}`, 'error');
    }
  };
  
  // Handle selected files for sending
  const handleSelectedFiles = (selectedFiles, targetId) => {
    if (!targetId || !peers[targetId]) {
      showNotification('No recipient selected', 'error');
      return;
    }
    
    // Convert FileList to Array
    const filesArray = Array.from(selectedFiles);
    
    // Process each file
    filesArray.forEach(fileObject => {
      // Check file size (limit to 50MB)
      if (fileObject.size > 50 * 1024 * 1024) {
        showNotification(`File ${fileObject.name} is too large (max 50MB)`, 'error');
        return;
      }
      
      const fileId = uuidv4();
      
      // Create a new file object
      setFiles(prev => {
        const newFiles = { ...prev };
        newFiles[fileId] = {
          id: fileId,
          fileObject: fileObject,
          name: fileObject.name,
          size: fileObject.size,
          type: fileObject.type,
          to: targetId,
          status: 'waiting',
          direction: 'outgoing'
        };
        return newFiles;
      });
      
      // Send file request to recipient
      socketRef.current.emit('file-request', {
        to: targetId,
        fileInfo: {
          name: fileObject.name,
          size: fileObject.size,
          type: fileObject.type
        }
      });
    });
    
    // Reset file input if it exists
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Show a notification
  const showNotification = (message, type = 'info') => {
    const id = `notification-${Date.now()}`;
    
    setNotifications(prev => [
      ...prev,
      { id, message, type }
    ]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    }, 5000);
  };
  
  // Copy room link to clipboard
  const copyRoomLink = () => {
    const roomLink = window.location.href;
    try {
      navigator.clipboard.writeText(roomLink)
        .then(() => {
          setCopySuccess(true);
          showNotification('Room link copied to clipboard');
          
          // Reset copy success after 2 seconds
          setTimeout(() => {
            setCopySuccess(false);
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy link:', err);
          showNotification('Failed to copy link: ' + err.message, 'error');
        });
    } catch (err) {
      console.error('Failed to copy link:', err);
      showNotification('Failed to copy link', 'error');
    }
  };
  
  // Create a new room
  const createNewRoom = () => {
    navigate('/');
  };
  
  // Handle file selection
  const handleFileSelect = (e, peerId) => {
    if (e.target.files.length > 0) {
      handleSelectedFiles(e.target.files, peerId);
    }
  };
  
  // Accept file transfer
  const acceptFileTransfer = (fileId) => {
    const file = files[fileId];
    if (!file || file.status !== 'pending') return;
    
    setFiles(prev => {
      const newFiles = { ...prev };
      newFiles[fileId].status = 'accepted';
      return newFiles;
    });
    
    socketRef.current.emit('file-response', { 
      to: file.from,
      accepted: true,
      fileId: fileId
    });
  };
  
  // Reject file transfer
  const rejectFileTransfer = (fileId) => {
    const file = files[fileId];
    if (!file || file.status !== 'pending') return;
    
    setFiles(prev => {
      const newFiles = { ...prev };
      newFiles[fileId].status = 'rejected';
      return newFiles;
    });
    
    socketRef.current.emit('file-response', { 
      to: file.from,
      accepted: false,
      fileId: fileId
    });
  };
  
  // Format file size to human-readable format
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Get file type icon
  const getFileTypeIcon = (fileType) => {
    if (!fileType) return faFile;
    
    if (fileType.startsWith('image/')) return faImage;
    if (fileType.startsWith('video/')) return faVideo;
    if (fileType.startsWith('audio/')) return faMusic;
    
    return faFile;
  };
  
  return (
    <div className="room-container">
      <header>
        <div className="logo">
          <FontAwesomeIcon icon={faShareNodes} className="logo-icon" />
          <h1>ShareIt</h1>
        </div>
        <div className="room-info">
          <p>Room: <span id="room-id">{roomId}</span></p>
          <button 
            className={`btn ${copySuccess ? 'btn-success' : ''}`} 
            onClick={copyRoomLink}
          >
            <FontAwesomeIcon icon={faCopy} /> {copySuccess ? 'Copied!' : 'Copy Link'}
          </button>
          <button className="btn" onClick={createNewRoom}>
            <FontAwesomeIcon icon={faPlus} /> New Room
          </button>
        </div>
      </header>

      <main>
        <div className="peers-container">
          <h2><FontAwesomeIcon icon={faUsers} /> People Nearby</h2>
          <div className="peers-list">
            {Object.keys(peers).length === 0 ? (
              <div className="no-peers">No one else is here yet.<br/>Share the link to invite others!</div>
            ) : (
              Object.values(peers).map(peer => (
                <div className="peer" key={peer.id} data-peer-id={peer.id}>
                  <div className="peer-avatar">
                    <FontAwesomeIcon icon={faUsers} />
                  </div>
                  <div className="peer-info">
                    <p className="peer-name">{peer.name}</p>
                    <p className="peer-status">Connected</p>
                  </div>
                  <label className="send-btn btn">
                    <FontAwesomeIcon icon={faPaperPlane} /> Send
                    <input 
                      type="file" 
                      hidden 
                      onChange={(e) => handleFileSelect(e, peer.id)}
                    />
                  </label>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="file-transfer">
          <div className="transfers-container">
            <h2><FontAwesomeIcon icon={faExchangeAlt} /> Transfers</h2>
            <div className="transfers-list">
              {Object.keys(files).length === 0 ? (
                <div className="no-transfers">No active transfers</div>
              ) : (
                Object.values(files).map(file => (
                  <div className="transfer" key={file.id} data-transfer-id={file.id}>
                    <div className="transfer-info">
                      <div className="transfer-icon">
                        <FontAwesomeIcon icon={getFileTypeIcon(file.type)} />
                      </div>
                      <div className="transfer-details">
                        <p className="transfer-filename">{file.name}</p>
                        {file.size && <p className="transfer-size">{formatFileSize(file.size)}</p>}
                        <p className={`transfer-status ${file.status}`}>
                          {file.status === 'pending' && 'Waiting for acceptance...'}
                          {file.status === 'waiting' && 'Waiting for recipient...'}
                          {file.status === 'transferring' && 'Transferring...'}
                          {file.status === 'accepted' && 'Accepted, waiting for transfer...'}
                          {file.status === 'completed' && 'Completed'}
                          {file.status === 'rejected' && 'Rejected'}
                          {file.status === 'failed' && 'Failed'}
                        </p>
                      </div>
                    </div>
                    <div className="transfer-actions">
                      {file.status === 'pending' && file.direction === 'incoming' && (
                        <>
                          <button 
                            className="transfer-accept btn"
                            onClick={() => acceptFileTransfer(file.id)}
                          >
                            <FontAwesomeIcon icon={faCheck} />
                          </button>
                          <button 
                            className="transfer-reject btn"
                            onClick={() => rejectFileTransfer(file.id)}
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        </>
                      )}
                      {file.status === 'completed' && file.direction === 'incoming' && (
                        <button 
                          className="transfer-download btn btn-success"
                          onClick={() => downloadFile(file.id)}
                        >
                          <FontAwesomeIcon icon={faDownload} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <div className="notification-container">
        {notifications.map(notification => (
          <div className={`notification ${notification.type}`} key={notification.id}>
            <div className="notification-icon">
              <FontAwesomeIcon icon={faInfoCircle} />
            </div>
            <div className="notification-content">
              <p className="notification-message">{notification.message}</p>
            </div>
            <button 
              className="notification-close"
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Room;
