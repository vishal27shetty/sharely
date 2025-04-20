// Main application code for ShareIt - P2P file sharing
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const roomIdElement = document.getElementById('room-id');
  const copyLinkButton = document.getElementById('copy-link');
  const newRoomButton = document.getElementById('new-room');
  const peersList = document.getElementById('peers-list');
  const transfersList = document.getElementById('transfers-list');
  const dropZone = document.querySelector('.drop-zone');
  const fileInput = document.getElementById('file-input');
  const selectFilesButton = document.getElementById('select-files');
  const notificationContainer = document.getElementById('notification-container');
  
  // Templates
  const peerTemplate = document.getElementById('peer-template');
  const transferTemplate = document.getElementById('transfer-template');
  const notificationTemplate = document.getElementById('notification-template');
  
  // State variables
  let socket;
  let peer;
  let roomId;
  let peers = {};
  let transfers = {};
  let transferIdCounter = 0;
  
  // File type icons mapping
  const fileTypeIcons = {
    'image': 'fa-image',
    'video': 'fa-video',
    'audio': 'fa-music',
    'application/pdf': 'fa-file-pdf',
    'application/msword': 'fa-file-word',
    'application/vnd.ms-excel': 'fa-file-excel',
    'application/vnd.ms-powerpoint': 'fa-file-powerpoint',
    'text/plain': 'fa-file-alt',
    'application/zip': 'fa-file-archive',
    'default': 'fa-file'
  };
  
  // Initialize the application
  function init() {
    // Get room ID from URL
    const path = window.location.pathname;
    if (path.startsWith('/room/')) {
      roomId = path.substring(6);
      roomIdElement.textContent = roomId;
    } else {
      // Redirect to a new room if not in a room
      window.location.href = '/new';
      return;
    }
    
    // Initialize Socket.io
    socket = io();
    
    // Initialize PeerJS
    peer = new Peer(undefined, {
      host: window.location.hostname,
      port: window.location.port,
      path: '/peerjs',
      debug: 2
    });
    
    // Set up event listeners
    setupSocketEvents();
    setupPeerEvents();
    setupUIEvents();
    
    // Join the room
    socket.emit('join-room', roomId);
  }
  
  // Set up Socket.io event listeners
  function setupSocketEvents() {
    // When we receive the list of users in the room
    socket.on('room-users', (users) => {
      users.forEach(user => {
        addPeer(user);
      });
      
      updatePeersUI();
    });
    
    // When a new user connects to the room
    socket.on('user-connected', (user) => {
      addPeer(user);
      updatePeersUI();
      showNotification(`New user connected`);
    });
    
    // When a user disconnects from the room
    socket.on('user-disconnected', (userId) => {
      removePeer(userId);
      updatePeersUI();
      showNotification(`User disconnected`);
    });
    
    // Handle WebRTC signaling
    socket.on('signal', ({ peerId, signal }) => {
      if (peers[peerId]) {
        peers[peerId].connection.signal(signal);
      }
    });
    
    // Handle file transfer offers
    socket.on('file-offer', ({ from, fileInfo }) => {
      const transferId = generateTransferId();
      
      // Create a new transfer object
      transfers[transferId] = {
        id: transferId,
        from: from,
        fileInfo: fileInfo,
        status: 'pending',
        progress: 0,
        direction: 'incoming'
      };
      
      updateTransfersUI();
      showNotification(`${peers[from]?.name || 'Someone'} wants to send you "${fileInfo.name}" (${formatFileSize(fileInfo.size)})`);
    });
    
    // Handle file transfer acceptance
    socket.on('file-accept', ({ from }) => {
      // Find the transfer associated with this peer
      const transferId = Object.keys(transfers).find(id => 
        transfers[id].to === from && transfers[id].status === 'waiting');
      
      if (transferId) {
        transfers[transferId].status = 'transferring';
        startFileTransfer(transferId);
        updateTransfersUI();
      }
    });
    
    // Handle file transfer rejection
    socket.on('file-reject', ({ from }) => {
      // Find the transfer associated with this peer
      const transferId = Object.keys(transfers).find(id => 
        transfers[id].to === from && transfers[id].status === 'waiting');
      
      if (transferId) {
        transfers[transferId].status = 'rejected';
        updateTransfersUI();
        showNotification(`Transfer rejected by recipient`);
      }
    });
  }
  
  // Set up PeerJS event listeners
  function setupPeerEvents() {
    peer.on('open', (id) => {
      console.log('My peer ID is:', id);
    });
    
    peer.on('connection', (conn) => {
      setupDataConnection(conn);
    });
    
    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      showNotification(`Connection error: ${err.type}`, 'error');
    });
  }
  
  // Set up UI event listeners
  function setupUIEvents() {
    // Copy room link to clipboard
    copyLinkButton.addEventListener('click', () => {
      const roomLink = window.location.href;
      navigator.clipboard.writeText(roomLink)
        .then(() => {
          showNotification('Room link copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy link:', err);
          showNotification('Failed to copy link', 'error');
        });
    });
    
    // Create a new room
    newRoomButton.addEventListener('click', () => {
      window.location.href = '/new';
    });
    
    // Handle file selection via button
    selectFilesButton.addEventListener('click', () => {
      fileInput.click();
    });
    
    // Handle file selection via input
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleSelectedFiles(e.target.files);
      }
    });
    
    // Handle drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('active');
    });
    
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('active');
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('active');
      
      if (e.dataTransfer.files.length > 0) {
        handleSelectedFiles(e.dataTransfer.files);
      }
    });
    
    // Delegate event listeners for dynamic elements
    peersList.addEventListener('click', (e) => {
      if (e.target.classList.contains('send-btn') || e.target.parentElement.classList.contains('send-btn')) {
        const peerElement = e.target.closest('.peer');
        if (peerElement) {
          const peerId = peerElement.dataset.peerId;
          fileInput.click();
          
          // Store the target peer ID for when files are selected
          fileInput.dataset.targetPeerId = peerId;
        }
      }
    });
    
    transfersList.addEventListener('click', (e) => {
      const transferElement = e.target.closest('.transfer');
      if (!transferElement) return;
      
      const transferId = transferElement.dataset.transferId;
      const transfer = transfers[transferId];
      
      if (e.target.classList.contains('transfer-accept') || e.target.parentElement.classList.contains('transfer-accept')) {
        // Accept file transfer
        if (transfer && transfer.status === 'pending') {
          transfer.status = 'accepted';
          socket.emit('file-accept', { peerId: transfer.from });
          updateTransfersUI();
        }
      } else if (e.target.classList.contains('transfer-reject') || e.target.parentElement.classList.contains('transfer-reject')) {
        // Reject file transfer
        if (transfer && transfer.status === 'pending') {
          transfer.status = 'rejected';
          socket.emit('file-reject', { peerId: transfer.from });
          updateTransfersUI();
        }
      } else if (e.target.classList.contains('transfer-cancel') || e.target.parentElement.classList.contains('transfer-cancel')) {
        // Cancel file transfer
        if (transfer) {
          transfer.status = 'cancelled';
          updateTransfersUI();
        }
      }
    });
    
    notificationContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('notification-close') || e.target.parentElement.classList.contains('notification-close')) {
        const notification = e.target.closest('.notification');
        if (notification) {
          notification.remove();
        }
      }
    });
  }
  
  // Add a peer to the peers list
  function addPeer(user) {
    if (peers[user.id]) return;
    
    peers[user.id] = {
      id: user.id,
      peerId: user.peerId,
      name: `User-${user.id.substring(0, 4)}`,
      connection: null
    };
    
    // Create a peer connection
    const conn = peer.connect(user.peerId, {
      reliable: true
    });
    
    if (conn) {
      setupDataConnection(conn);
      peers[user.id].connection = conn;
    }
  }
  
  // Remove a peer from the peers list
  function removePeer(userId) {
    if (peers[userId]) {
      if (peers[userId].connection) {
        peers[userId].connection.close();
      }
      delete peers[userId];
    }
  }
  
  // Set up a data connection with a peer
  function setupDataConnection(conn) {
    conn.on('open', () => {
      console.log('Connection opened with peer:', conn.peer);
      
      // Find the peer by connection ID
      const peerId = Object.keys(peers).find(id => peers[id].peerId === conn.peer);
      if (peerId) {
        peers[peerId].connection = conn;
      }
    });
    
    conn.on('data', (data) => {
      handleIncomingData(conn.peer, data);
    });
    
    conn.on('close', () => {
      console.log('Connection closed with peer:', conn.peer);
    });
    
    conn.on('error', (err) => {
      console.error('Connection error:', err);
    });
  }
  
  // Handle incoming data from a peer
  function handleIncomingData(peerId, data) {
    if (!data || !data.type) return;
    
    switch (data.type) {
      case 'file-chunk':
        handleFileChunk(data);
        break;
      case 'file-complete':
        completeFileTransfer(data.transferId);
        break;
      default:
        console.warn('Unknown data type:', data.type);
    }
  }
  
  // Handle selected files for sending
  function handleSelectedFiles(files) {
    const targetPeerId = fileInput.dataset.targetPeerId;
    
    if (!targetPeerId || !peers[targetPeerId]) {
      showNotification('No recipient selected', 'error');
      return;
    }
    
    // Clear the target peer ID
    delete fileInput.dataset.targetPeerId;
    
    // Convert FileList to Array
    const filesArray = Array.from(files);
    
    // Process each file
    filesArray.forEach(file => {
      const fileInfo = {
        name: file.name,
        size: file.size,
        type: file.type
      };
      
      const transferId = generateTransferId();
      
      // Create a new transfer object
      transfers[transferId] = {
        id: transferId,
        file: file,
        fileInfo: fileInfo,
        to: targetPeerId,
        status: 'waiting',
        progress: 0,
        direction: 'outgoing'
      };
      
      // Send file offer to recipient
      socket.emit('file-offer', {
        peerId: targetPeerId,
        fileInfo: fileInfo
      });
      
      updateTransfersUI();
    });
    
    // Reset file input
    fileInput.value = '';
  }
  
  // Start file transfer
  function startFileTransfer(transferId) {
    const transfer = transfers[transferId];
    if (!transfer || transfer.status !== 'transferring') return;
    
    const file = transfer.file;
    const peerConnection = peers[transfer.to].connection;
    
    if (!peerConnection) {
      transfer.status = 'failed';
      updateTransfersUI();
      showNotification('Connection to peer lost', 'error');
      return;
    }
    
    const chunkSize = 16384; // 16KB chunks
    let offset = 0;
    
    function sendChunk() {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const chunk = e.target.result;
        
        // Send chunk to peer
        peerConnection.send({
          type: 'file-chunk',
          transferId: transferId,
          chunk: chunk,
          offset: offset
        });
        
        // Update progress
        offset += chunk.byteLength;
        const progress = Math.min(100, Math.floor((offset / file.size) * 100));
        transfer.progress = progress;
        updateTransfersUI();
        
        // Continue sending chunks or complete
        if (offset < file.size) {
          setTimeout(sendChunk, 0);
        } else {
          // Send completion message
          peerConnection.send({
            type: 'file-complete',
            transferId: transferId
          });
          
          transfer.status = 'completed';
          updateTransfersUI();
          showNotification(`File "${file.name}" sent successfully`);
        }
      };
      
      const slice = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    }
    
    // Start sending chunks
    sendChunk();
  }
  
  // Handle incoming file chunk
  function handleFileChunk(data) {
    const { transferId, chunk, offset } = data;
    const transfer = transfers[transferId];
    
    if (!transfer) return;
    
    // Initialize file buffer if not exists
    if (!transfer.buffer) {
      transfer.buffer = [];
      transfer.receivedSize = 0;
    }
    
    // Add chunk to buffer
    transfer.buffer.push({
      data: chunk,
      offset: offset
    });
    
    // Update received size and progress
    transfer.receivedSize += chunk.byteLength;
    transfer.progress = Math.min(100, Math.floor((transfer.receivedSize / transfer.fileInfo.size) * 100));
    
    updateTransfersUI();
  }
  
  // Complete file transfer and save file
  function completeFileTransfer(transferId) {
    const transfer = transfers[transferId];
    if (!transfer || !transfer.buffer) return;
    
    // Sort chunks by offset
    transfer.buffer.sort((a, b) => a.offset - b.offset);
    
    // Combine chunks
    const fileBlob = new Blob(
      transfer.buffer.map(chunk => chunk.data),
      { type: transfer.fileInfo.type || 'application/octet-stream' }
    );
    
    // Create download link
    const downloadUrl = URL.createObjectURL(fileBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = transfer.fileInfo.name;
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Update transfer status
    transfer.status = 'completed';
    updateTransfersUI();
    showNotification(`File "${transfer.fileInfo.name}" received successfully`);
    
    // Clean up
    delete transfer.buffer;
    URL.revokeObjectURL(downloadUrl);
  }
  
  // Update the peers UI
  function updatePeersUI() {
    // Clear existing peers
    peersList.innerHTML = '';
    
    // Check if there are any peers
    if (Object.keys(peers).length === 0) {
      const noPeersElement = document.createElement('div');
      noPeersElement.className = 'no-peers';
      noPeersElement.textContent = 'No one else is here yet. Share the link to invite others!';
      peersList.appendChild(noPeersElement);
      return;
    }
    
    // Add peers to the list
    Object.values(peers).forEach(peer => {
      const peerElement = peerTemplate.content.cloneNode(true);
      const peerDiv = peerElement.querySelector('.peer');
      
      peerDiv.dataset.peerId = peer.id;
      peerElement.querySelector('.peer-name').textContent = peer.name;
      
      peersList.appendChild(peerElement);
    });
  }
  
  // Update the transfers UI
  function updateTransfersUI() {
    // Clear existing transfers
    transfersList.innerHTML = '';
    
    // Check if there are any transfers
    if (Object.keys(transfers).length === 0) {
      const noTransfersElement = document.createElement('div');
      noTransfersElement.className = 'no-transfers';
      noTransfersElement.textContent = 'No active transfers';
      transfersList.appendChild(noTransfersElement);
      return;
    }
    
    // Add transfers to the list
    Object.values(transfers).forEach(transfer => {
      const transferElement = transferTemplate.content.cloneNode(true);
      const transferDiv = transferElement.querySelector('.transfer');
      
      transferDiv.dataset.transferId = transfer.id;
      
      // Set file icon based on type
      const fileType = transfer.fileInfo.type.split('/')[0];
      const iconClass = fileTypeIcons[fileType] || fileTypeIcons[transfer.fileInfo.type] || fileTypeIcons.default;
      transferElement.querySelector('.transfer-icon i').className = `fas ${iconClass}`;
      
      // Set file details
      transferElement.querySelector('.transfer-filename').textContent = transfer.fileInfo.name;
      transferElement.querySelector('.transfer-size').textContent = formatFileSize(transfer.fileInfo.size);
      
      // Set progress
      transferElement.querySelector('.transfer-progress').style.width = `${transfer.progress}%`;
      
      // Set status text and action buttons
      const statusElement = transferElement.querySelector('.transfer-status');
      const acceptButton = transferElement.querySelector('.transfer-accept');
      const rejectButton = transferElement.querySelector('.transfer-reject');
      const cancelButton = transferElement.querySelector('.transfer-cancel');
      
      switch (transfer.status) {
        case 'pending':
          statusElement.textContent = 'Waiting for acceptance...';
          if (transfer.direction === 'incoming') {
            acceptButton.hidden = false;
            rejectButton.hidden = false;
          }
          break;
        case 'waiting':
          statusElement.textContent = 'Waiting for recipient...';
          if (transfer.direction === 'outgoing') {
            cancelButton.hidden = false;
          }
          break;
        case 'transferring':
          statusElement.textContent = `Transferring... ${transfer.progress}%`;
          cancelButton.hidden = false;
          break;
        case 'completed':
          statusElement.textContent = 'Completed';
          statusElement.style.color = '#10b981';
          break;
        case 'rejected':
          statusElement.textContent = 'Rejected';
          statusElement.style.color = '#ef4444';
          break;
        case 'cancelled':
          statusElement.textContent = 'Cancelled';
          statusElement.style.color = '#ef4444';
          break;
        case 'failed':
          statusElement.textContent = 'Failed';
          statusElement.style.color = '#ef4444';
          break;
        default:
          statusElement.textContent = transfer.status;
      }
      
      transfersList.appendChild(transferElement);
    });
  }
  
  // Show a notification
  function showNotification(message, type = 'info') {
    const notificationElement = notificationTemplate.content.cloneNode(true);
    const notification = notificationElement.querySelector('.notification');
    
    notification.querySelector('.notification-message').textContent = message;
    
    // Set icon based on type
    const iconElement = notification.querySelector('.notification-icon i');
    switch (type) {
      case 'error':
        iconElement.className = 'fas fa-exclamation-circle';
        iconElement.style.color = '#ef4444';
        break;
      case 'success':
        iconElement.className = 'fas fa-check-circle';
        iconElement.style.color = '#10b981';
        break;
      case 'warning':
        iconElement.className = 'fas fa-exclamation-triangle';
        iconElement.style.color = '#f59e0b';
        break;
      default:
        iconElement.className = 'fas fa-info-circle';
        iconElement.style.color = '#4f46e5';
    }
    
    notificationContainer.appendChild(notification);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentNode === notificationContainer) {
        notification.remove();
      }
    }, 5000);
  }
  
  // Format file size to human-readable format
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // Generate a unique transfer ID
  function generateTransferId() {
    return `transfer-${Date.now()}-${transferIdCounter++}`;
  }
  
  // Initialize the application
  init();
});
