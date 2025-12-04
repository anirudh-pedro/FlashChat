import { io } from 'socket.io-client';

// Default to localhost for development
const ENDPOINT = process.env.NODE_ENV === 'production'
  ? 'https://flashchat-oyd6.onrender.com'
  : 'http://localhost:5000';

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
    timeout: 20000, // Increase timeout to 20 seconds
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

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  joinRoom,
  sendMessage,
  leaveRoom
};