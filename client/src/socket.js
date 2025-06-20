import { io } from 'socket.io-client';

// Default to localhost for development
const ENDPOINT = import.meta.env.VITE_SERVER_ENDPOINT || 'http://localhost:5000';

// Create a socket instance
let socket;

// Initialize socket connection
export const initSocket = () => {
  console.log("Initializing socket connection");
  socket = io(ENDPOINT, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
  
  socket.on('connect', () => {
    console.log("Socket connected successfully", socket.id);
  });
  
  socket.on('connect_error', (err) => {
    console.error("Socket connection error:", err);
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