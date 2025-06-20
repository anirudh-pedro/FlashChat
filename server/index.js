const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const socketIO = require('socket.io');
const { setupSocketHandlers } = require('./socketHandler');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://flashchat-oyd6.onrender.com' 
    : '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Basic route for checking server status
app.get('/', (req, res) => {
  res.send({ 
    status: 'online',
    message: 'FlashChat server is running'
  });
});

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Set up socket handlers
setupSocketHandlers(io);

// Set port and start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`⚡ Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO ready for connections`);
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  io.close();
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});