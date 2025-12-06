const { 
  addUser, 
  removeUser, 
  getUser, 
  getUsersInRoom,
  getRoomCount,
  isRoomActive
} = require('./utils/userManager');

// ==================== RATE LIMITING ====================
// Rate limiting configuration
const RATE_LIMITS = {
  message: {
    maxRequests: 10,      // Maximum 10 messages
    windowMs: 10000,      // Per 10 seconds
    blockDurationMs: 30000 // Block for 30 seconds if exceeded
  },
  join: {
    maxRequests: 3,       // Maximum 3 join attempts
    windowMs: 60000,      // Per 60 seconds (1 minute)
    blockDurationMs: 60000 // Block for 60 seconds if exceeded
  }
};

// Store rate limit data for each socket
// Structure: Map<socketId, Map<actionType, { count, resetTime, blockedUntil }>>
const rateLimitStore = new Map();

/**
 * Check if action is rate limited
 * @param {string} socketId - Socket ID
 * @param {string} actionType - Type of action ('message', 'join')
 * @returns {Object} - { allowed: boolean, error?: string, retryAfter?: number }
 */
const checkRateLimit = (socketId, actionType) => {
  const now = Date.now();
  const config = RATE_LIMITS[actionType];
  
  if (!config) {
    return { allowed: true };
  }
  
  // Get or initialize rate limit data for this socket
  if (!rateLimitStore.has(socketId)) {
    rateLimitStore.set(socketId, new Map());
  }
  
  const socketLimits = rateLimitStore.get(socketId);
  
  // Get or initialize rate limit data for this action
  if (!socketLimits.has(actionType)) {
    socketLimits.set(actionType, {
      count: 0,
      resetTime: now + config.windowMs,
      blockedUntil: 0
    });
  }
  
  const limitData = socketLimits.get(actionType);
  
  // Check if currently blocked
  if (limitData.blockedUntil > now) {
    const retryAfter = Math.ceil((limitData.blockedUntil - now) / 1000);
    return {
      allowed: false,
      error: `Too many ${actionType} requests. Please try again in ${retryAfter} seconds.`,
      retryAfter
    };
  }
  
  // Reset counter if time window has passed
  if (now > limitData.resetTime) {
    limitData.count = 0;
    limitData.resetTime = now + config.windowMs;
    limitData.blockedUntil = 0;
  }
  
  // Check if limit exceeded
  if (limitData.count >= config.maxRequests) {
    limitData.blockedUntil = now + config.blockDurationMs;
    const retryAfter = Math.ceil(config.blockDurationMs / 1000);
    console.log(`🚫 Rate limit exceeded for ${socketId} on ${actionType}`);
    return {
      allowed: false,
      error: `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
      retryAfter
    };
  }
  
  // Increment counter
  limitData.count++;
  
  return { allowed: true };
};

/**
 * Clean up rate limit data when socket disconnects
 * @param {string} socketId - Socket ID
 */
const cleanupRateLimit = (socketId) => {
  rateLimitStore.delete(socketId);
};

// ==================== END RATE LIMITING ====================

const setupSocketHandlers = (io) => {
  // Handle new connections
  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // Handle user joining a room
    socket.on('join', ({ username, room }, callback) => {
      try {
        // Check rate limit for join action
        const rateLimitCheck = checkRateLimit(socket.id, 'join');
        if (!rateLimitCheck.allowed) {
          if (callback) callback({ error: rateLimitCheck.error });
          return;
        }
        
        // Validate inputs
        if (!username || !room) {
          if (callback) callback({ error: 'Username and room are required' });
          return;
        }
        
        // Validate username length
        if (username.trim().length > 20) {
          if (callback) callback({ error: 'Username too long (max 20 characters)' });
          return;
        }
        
        if (username.trim().length < 2) {
          if (callback) callback({ error: 'Username too short (min 2 characters)' });
          return;
        }

        // Add user to in-memory storage
        const { error, user } = addUser({ id: socket.id, username, room });
        if (error) return callback({ error });

        // Join the socket to the specified room
        socket.join(user.room);

        // Send welcome message to user
        socket.emit('message', {
          user: 'System',
          text: `Welcome to ${user.room.startsWith('loc_') ? 'the nearby chat' : 'room ' + user.room}!`,
          createdAt: new Date().toISOString()
        });

        // Notify other users that someone joined
        socket.to(user.room).emit('message', {
          user: 'System',
          text: `${user.username} has joined`,
          createdAt: new Date().toISOString()
        });

        // Notify clients about user joining (for toast notifications)
        socket.to(user.room).emit('userJoined', user.username);

        // Send updated room data to all users in the room
        io.to(user.room).emit('roomData', {
          room: user.room,
          users: getUsersInRoom(user.room)
        });

        if (callback) callback();
      } catch (error) {
        console.error('Error in join handler:', error);
        if (callback) callback({ error: 'Server error, please try again' });
      }
    });
    
    // Handle room ID availability check
    socket.on('checkRoomAvailability', (roomId, callback) => {
      const isActive = isRoomActive(roomId);
      callback({ isActive });
    });
    
    // Handle messages
    socket.on('sendMessage', (message, callback) => {
      try {
        // Check rate limit for message action
        const rateLimitCheck = checkRateLimit(socket.id, 'message');
        if (!rateLimitCheck.allowed) {
          if (callback) callback({ error: rateLimitCheck.error });
          return;
        }
        
        const user = getUser(socket.id);
        if (!user) {
          if (callback) callback({ error: 'User not found' });
          return;
        }

        // Validate message
        if (!message || typeof message !== 'string') {
          if (callback) callback({ error: 'Invalid message format' });
          return;
        }

        const trimmedMessage = message.trim();
        
        // Check message length
        if (trimmedMessage.length === 0) {
          if (callback) callback({ error: 'Message cannot be empty' });
          return;
        }
        
        if (trimmedMessage.length > 1000) {
          if (callback) callback({ error: 'Message too long (max 1000 characters)' });
          return;
        }

        // Create message object with validated content
        const messageObj = {
          user: user.username,
          text: trimmedMessage,
          createdAt: new Date().toISOString()
        };

        // Send to everyone in the room including sender
        io.to(user.room).emit('message', messageObj);
        
        if (callback) callback();
      } catch (error) {
        console.error('Error in sendMessage handler:', error);
        if (callback) callback({ error: 'Failed to send message' });
      }
    });
    
    // Handle user explicitly leaving
    socket.on('leaveRoom', () => {
      const user = removeUser(socket.id);
      
      if (user) {
        handleUserLeaving(socket, user);
      }
    });
    
    // Handle disconnects (browser close, etc.)
    socket.on('disconnect', () => {
      console.log(`Connection disconnected: ${socket.id}`);
      
      // Clean up rate limit data for this socket
      cleanupRateLimit(socket.id);
      
      const user = removeUser(socket.id);
      
      if (user) {
        handleUserLeaving(socket, user);
      }
    });
  });

  // Helper function for handling a user leaving
  const handleUserLeaving = (socket, user) => {
    // Notify other users in the room
    socket.to(user.room).emit('message', {
      user: 'System',
      text: `${user.username} has left`,
      createdAt: new Date().toISOString()
    });

    // Notify for toast
    socket.to(user.room).emit('userLeft', user.username);

    // Send updated room data
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room)
    });

    // If room is now empty, we could clean it up
    // (though this is optional since it's in-memory anyway)
    const roomUserCount = getRoomCount(user.room);
    if (roomUserCount === 0) {
      console.log(`Room ${user.room} is now empty`);
    }
  };

  return io;
};

module.exports = { setupSocketHandlers };