import { io } from 'socket.io-client';

// Default to localhost for development
// Use VITE_API_URL if set, otherwise detect based on current location
const getEndpoint = () => {
  // If running on localhost/127.0.0.1, use local server
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }
  
  // Otherwise use production server
  return import.meta.env.VITE_API_URL || 'https://flashchat-oyd6.onrender.com';
};

const ENDPOINT = getEndpoint();

console.log('🔌 Connecting to:', ENDPOINT);

// Create a socket instance
let socket;

// Initialize socket connection
export const initSocket = () => {
  // Return existing socket if already connected
  if (socket && socket.connected) {
    console.log("Socket already connected", socket.id);
    return socket;
  }
  
  console.log("Initializing socket connection");
  socket = io(ENDPOINT, {
    transports: ['websocket', 'polling'], // Use polling as fallback
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 30000, // Increase timeout to 30 seconds for slow servers
    autoConnect: true,
  });
  
  socket.on('connect', () => {
    console.log("Socket connected successfully", socket.id);
  });
  
  socket.on('connect_error', (err) => {
    console.error("Socket connection error:", err.message);
  });
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Reconnection attempt ${attemptNumber}`);
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconnected after ${attemptNumber} attempts`);
  });
  
  return socket;
};

// Get the current socket instance
export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

// Disconnect socket
export const disconnectSocket = () => {
  console.log("Disconnecting socket", socket?.id, "Connected:", socket?.connected);
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

// Join a room
export const joinRoom = (userData, callback) => {
  if (!socket) initSocket();
  socket.emit('join', userData, callback);
};

// Send a message
export const sendMessage = (message, callback) => {
  if (!socket) return;
  socket.emit('sendMessage', message, callback);
};

// Leave a room
export const leaveRoom = () => {
  if (!socket) return;
  socket.emit('leaveRoom');
};

// Approve a join request (admin only)
export const approveJoin = (pendingSocketId, room, callback) => {
  if (!socket) return;
  socket.emit('approveJoin', { pendingSocketId, room }, callback);
};

// Reject a join request (admin only)
export const rejectJoin = (pendingSocketId, room, reason, callback) => {
  if (!socket) return;
  socket.emit('rejectJoin', { pendingSocketId, room, reason }, callback);
};

// Cancel pending join request
export const cancelJoinRequest = (room, callback) => {
  if (!socket) return;
  socket.emit('cancelJoinRequest', { room }, callback);
};

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  joinRoom,
  sendMessage,
  leaveRoom,
  approveJoin,
  rejectJoin,
  cancelJoinRequest
};