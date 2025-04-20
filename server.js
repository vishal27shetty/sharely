const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());

// Socket.io with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 100 * 1024 * 1024 // 100MB max buffer size
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/dist')));

// Store active rooms and connections
const rooms = {};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Join room (each room represents a sharing session)
  socket.on('join-room', (roomId, userId) => {
    console.log(`User ${userId} joining room ${roomId}`);
    
    // Leave previous rooms
    if (socket.roomId) {
      socket.leave(socket.roomId);
      if (rooms[socket.roomId]) {
        delete rooms[socket.roomId][socket.id];
        // Notify other users in the room
        socket.to(socket.roomId).emit('user-disconnected', socket.id);
      }
    }
    
    // Join new room
    socket.join(roomId);
    socket.roomId = roomId;
    
    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {};
    }
    
    // Add user to room
    rooms[roomId][socket.id] = {
      id: socket.id,
      peerId: userId
    };
    
    // Notify user about existing peers
    const peers = [];
    for (const peerId in rooms[roomId]) {
      if (peerId !== socket.id) {
        peers.push({
          id: peerId,
          peerId: rooms[roomId][peerId].peerId
        });
      }
    }
    
    console.log(`Sending room users to ${socket.id}:`, peers);
    socket.emit('room-users', peers);
    
    // Notify other users about new peer
    socket.to(roomId).emit('user-connected', {
      id: socket.id,
      peerId: userId
    });
  });
  
  // Handle file transfer request
  socket.on('file-request', ({ to, fileInfo }) => {
    console.log(`File request from ${socket.id} to ${to}:`, fileInfo);
    io.to(to).emit('file-request', {
      from: socket.id,
      fileInfo
    });
  });
  
  // Handle file transfer response
  socket.on('file-response', ({ to, accepted, fileId }) => {
    console.log(`File ${accepted ? 'accepted' : 'rejected'} by ${socket.id}`);
    io.to(to).emit('file-response', {
      from: socket.id,
      accepted,
      fileId
    });
  });
  
  // Handle file transfer (direct, no chunking)
  socket.on('file-transfer', ({ to, fileData, fileName, fileType }) => {
    console.log(`Transferring file ${fileName} from ${socket.id} to ${to}`);
    io.to(to).emit('file-transfer', {
      from: socket.id,
      fileData,
      fileName,
      fileType
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.roomId && rooms[socket.roomId]) {
      delete rooms[socket.roomId][socket.id];
      // Notify other users in the room
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
      
      // Clean up empty rooms
      if (Object.keys(rooms[socket.roomId]).length === 0) {
        delete rooms[socket.roomId];
      }
    }
  });
});

// Debug endpoint to see active rooms
app.get('/api/debug/rooms', (req, res) => {
  res.json({ rooms });
});

// Catch-all handler for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
