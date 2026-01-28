import { io } from 'socket.io-client';

const getEndpoint = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }
  
  return import.meta.env.VITE_API_URL || 'https://flashchat-oyd6.onrender.com';
};

const ENDPOINT = getEndpoint();

console.log('🔌 Connecting to:', ENDPOINT);

let socket;

let isIntentionalLeave = false;

export const setIntentionalLeave = (value) => {
  isIntentionalLeave = value;
};

export const initSocket = () => {
  if (socket && socket.connected) {
    console.log("Socket already connected", socket.id);
    return socket;
  }
  
  console.log("Initializing socket connection");
  socket = io(ENDPOINT, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 30000,
    autoConnect: true,
    pingTimeout: 60000,
    pingInterval: 25000,
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

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  console.log("Disconnecting socket", socket?.id, "Connected:", socket?.connected);
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

export const joinRoom = (userData, callback) => {
  if (!socket) initSocket();
  
  const storedToken = localStorage.getItem(`adminToken_${userData.room}`);
  const dataWithToken = { ...userData, adminToken: storedToken };
  
  socket.emit('join', dataWithToken, callback);
};

export const sendMessage = (message, callback) => {
  if (!socket) return;
  socket.emit('sendMessage', message, callback);
};

export const leaveRoom = () => {
  if (!socket) return;
  isIntentionalLeave = true;
  socket.emit('leaveRoom');
};

export const approveJoin = (pendingSocketId, room, callback) => {
  if (!socket) return;
  socket.emit('approveJoin', { pendingSocketId, room }, callback);
};

export const rejectJoin = (pendingSocketId, room, reason, callback) => {
  if (!socket) return;
  socket.emit('rejectJoin', { pendingSocketId, room, reason }, callback);
};

export const cancelJoinRequest = (room, callback) => {
  if (!socket) return;
  socket.emit('cancelJoinRequest', { room }, callback);
};

export const kickUser = (targetSocketId, room, callback) => {
  if (!socket) return;
  socket.emit('kickUser', { targetSocketId, room }, callback);
};