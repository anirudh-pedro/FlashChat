// Redis-based user management (with in-memory fallback)
const { 
  addUser, 
  removeUser, 
  getUser, 
  getUsersInRoom,
  getRoomCount,
  getRoomInfo,
  checkRoomCapacity,
  isRoomActive,
  isRoomAdmin,
  getRoomAdmin,
  getRoomAdminToken,
  isRoomAdminRequired,
  transferAdmin,
  addPendingUser,
  getPendingUsers,
  removePendingUser,
  clearPendingUsers,
  scheduleRoomCleanup,
  cancelRoomCleanup,
  ROOM_CAPACITY
} = require('./utils/userManagerRedis');

// Redis message persistence
const { 
  saveMessage, 
  getRecentMessages, 
  updateMessage: updateMessageInRedis, 
  deleteMessage: deleteMessageFromRedis,
  clearRoomMessages
} = require('./src/services/messageService');

// ==================== INPUT SANITIZATION ====================
/**
 * Sanitize user input to prevent XSS (Cross-Site Scripting) attacks
 * This function removes or escapes potentially dangerous characters
 * 
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized safe string
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    // Remove null bytes (can cause issues)
    .replace(/\0/g, '')
    // Escape HTML special characters to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove any control characters except newline and tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Trim whitespace
    .trim();
};

/**
 * Sanitize username - stricter than general input
 * Usernames should only contain alphanumeric characters, spaces, underscores, and hyphens
 * 
 * @param {string} username - Raw username input
 * @returns {string} - Sanitized username
 */
const sanitizeUsername = (username) => {
  if (typeof username !== 'string') {
    return '';
  }
  
  return username
    .trim()
    // Remove any characters that aren't alphanumeric, space, underscore, or hyphen
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    // Collapse multiple spaces into one
    .replace(/\s+/g, ' ')
    // Remove leading/trailing spaces again
    .trim();
};

/**
 * Sanitize room ID - only allow uppercase letters and numbers
 * 
 * @param {string} roomId - Raw room ID input
 * @returns {string} - Sanitized room ID
 */
const sanitizeRoomId = (roomId) => {
  if (typeof roomId !== 'string') {
    return '';
  }
  
  return roomId
    .trim()
    .toUpperCase()
    // For location-based rooms, allow LOC_ prefix with numbers, dots, and minus
    // For regular rooms, only allow alphanumeric characters
    .replace(/[^A-Z0-9._-]/g, '');
};

/**
 * Validate and sanitize message content
 * Checks for dangerous patterns and suspicious content
 * 
 * @param {string} message - Raw message input
 * @returns {Object} - { isValid: boolean, sanitized: string, reason?: string }
 */
const sanitizeMessage = (message) => {
  if (typeof message !== 'string') {
    return { isValid: false, sanitized: '', reason: 'Invalid message type' };
  }
  
  const trimmed = message.trim();
  
  // Check for empty message
  if (trimmed.length === 0) {
    return { isValid: false, sanitized: '', reason: 'Empty message' };
  }
  
  // Check for suspicious patterns (basic XSS attempts)
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,  // Script tags
    /javascript:/gi,                   // JavaScript protocol
    /on\w+\s*=/gi,                    // Event handlers (onclick, onload, etc.)
    /<iframe/gi,                       // Iframes
    /<object/gi,                       // Objects
    /<embed/gi,                        // Embeds
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      console.warn('🚨 Dangerous pattern detected in message');
      return { 
        isValid: false, 
        sanitized: '', 
        reason: 'Message contains potentially dangerous content' 
      };
    }
  }
  
  // Sanitize the message
  const sanitized = sanitizeInput(trimmed);
  
  return { isValid: true, sanitized };
};

// ==================== END INPUT SANITIZATION ====================

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

// Track recently removed users to prevent duplicate leave messages
const recentlyRemovedUsers = new Set();

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
    socket.on('join', async ({ username, room, adminToken, requireAdmin }, callback) => {
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
        
        // Sanitize username and room ID
        const sanitizedUsername = sanitizeUsername(username);
        const sanitizedRoom = sanitizeRoomId(room);
        
        // Check if sanitization removed everything (suspicious input)
        if (!sanitizedUsername || !sanitizedRoom) {
          if (callback) callback({ error: 'Invalid username or room ID format' });
          return;
        }
        
        // Validate username length (after sanitization)
        if (sanitizedUsername.length > 20) {
          if (callback) callback({ error: 'Username too long (max 20 characters)' });
          return;
        }
        
        if (sanitizedUsername.length < 2) {
          if (callback) callback({ error: 'Username too short (min 2 characters)' });
          return;
        }

        // Check if room already has users (admin exists)
        const currentAdmin = await getRoomAdmin(sanitizedRoom);
        const currentAdminToken = await getRoomAdminToken(sanitizedRoom);
        const roomCount = await getRoomCount(sanitizedRoom);
        const isNearbyRoom = sanitizedRoom.startsWith('LOC_');
        const roomRequiresAdmin = await isRoomAdminRequired(sanitizedRoom);
        
        // Check if this user is the admin (has matching token)
        const isReturningAdmin = adminToken && currentAdminToken && adminToken === currentAdminToken;
        
        // Require approval ONLY if:
        // 1. Room has admin and users
        // 2. NOT a nearby room (LOC_)
        // 3. NOT the returning admin
        // 4. Room has admin control enabled (requireAdmin = true)
        if (currentAdmin && roomCount > 0 && !isNearbyRoom && !isReturningAdmin && roomRequiresAdmin) {
          // Add user to pending list
          await addPendingUser(sanitizedRoom, {
            socketId: socket.id,
            username: sanitizedUsername,
            requestedAt: new Date().toISOString()
          });
          
          // Notify admin about pending request
          io.to(currentAdmin).emit('joinRequest', {
            socketId: socket.id,
            username: sanitizedUsername,
            room: sanitizedRoom
          });
          
          // Tell the requesting user they're waiting
          if (callback) callback({ 
            pending: true, 
            message: 'Waiting for admin approval...' 
          });
          
          console.log(`⏳ User ${sanitizedUsername} waiting for approval to join ${sanitizedRoom}`);
          return;
        }

        // Add user - pass admin token for verification and requireAdmin for room settings
        const { error, user, adminToken: returnedAdminToken } = await addUser({ 
          id: socket.id, 
          username: sanitizedUsername, 
          room: sanitizedRoom,
          adminToken: adminToken, // Pass the token for verification
          requireAdmin: requireAdmin === true || requireAdmin === 'true' // Room requires admin approval
        });
        if (error) return callback({ error });

        // Cancel any pending room cleanup
        cancelRoomCleanup(user.room);

        // Join the socket to the specified room
        socket.join(user.room);

        // Fetch chat history from Redis and send to user
        const chatHistory = await getRecentMessages(user.room);
        if (chatHistory.length > 0) {
          socket.emit('chatHistory', chatHistory);
        }

        // Send welcome message to user (not persisted - it's ephemeral)
        socket.emit('message', {
          user: 'System',
          text: `Welcome to ${user.room.startsWith('LOC_') ? 'the nearby chat' : 'room ' + user.room}!`,
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

        // Send updated room data to all users in the room (including capacity info)
        const roomInfo = await getRoomInfo(user.room);
        const usersInRoom = await getUsersInRoom(user.room);
        const adminSocketId = await getRoomAdmin(user.room);
        const pendingUsers = await getPendingUsers(user.room);
        
        io.to(user.room).emit('roomData', {
          room: user.room,
          users: usersInRoom,
          capacity: roomInfo.capacity,
          available: roomInfo.available,
          isFull: roomInfo.isFull,
          adminId: adminSocketId,
          pendingUsers: pendingUsers
        });
        
        // Tell the user if they are admin (and send the token if they are)
        const isUserAdmin = user.isAdmin || socket.id === adminSocketId;
        socket.emit('adminStatus', { 
          isAdmin: isUserAdmin,
          adminToken: isUserAdmin ? returnedAdminToken : null
        });

        if (callback) callback({ adminToken: returnedAdminToken });
      } catch (error) {
        console.error('Error in join handler:', error);
        if (callback) callback({ error: 'Server error, please try again' });
      }
    });
    
    // Handle room ID availability check
    socket.on('checkRoomAvailability', async (roomId, callback) => {
      const isActive = await isRoomActive(roomId);
      callback({ isActive });
    });
    
    // Handle room capacity check
    socket.on('checkRoomCapacity', async (roomId, callback) => {
      try {
        if (!roomId || typeof roomId !== 'string') {
          return callback({ error: 'Invalid room ID' });
        }
        
        const capacityInfo = await checkRoomCapacity(roomId);
        const roomInfo = await getRoomInfo(roomId);
        
        callback({ 
          success: true,
          capacity: capacityInfo.limit,
          current: capacityInfo.current,
          available: capacityInfo.available,
          isFull: capacityInfo.isFull,
          users: roomInfo.users.map(u => u.username) // Don't send socket IDs
        });
      } catch (error) {
        console.error('Error checking room capacity:', error);
        callback({ error: 'Failed to check room capacity' });
      }
    });

    // ==================== ADMIN APPROVAL HANDLERS ====================
    
    // Handle admin approving a join request
    socket.on('approveJoin', async ({ pendingSocketId, room }, callback) => {
      try {
        // Get the current user first
        const currentUser = await getUser(socket.id);
        if (!currentUser) {
          if (callback) callback({ error: 'You are not in a room' });
          return;
        }
        
        // Verify the approver is the admin (check by both socket ID and username)
        const isAdmin = await isRoomAdmin(socket.id, room, currentUser.username);
        if (!isAdmin) {
          if (callback) callback({ error: 'Only the admin can approve join requests' });
          return;
        }
        
        // Get pending user info
        const pendingUser = await removePendingUser(room, pendingSocketId);
        if (!pendingUser) {
          if (callback) callback({ error: 'Pending user not found' });
          return;
        }
        
        // Add the approved user
        const { error, user } = await addUser({ 
          id: pendingSocketId, 
          username: pendingUser.username, 
          room 
        });
        
        if (error) {
          // Notify the pending user of rejection
          io.to(pendingSocketId).emit('joinRejected', { reason: error });
          if (callback) callback({ error });
          return;
        }
        
        // Join the socket to the room
        const pendingSocket = io.sockets.sockets.get(pendingSocketId);
        if (pendingSocket) {
          pendingSocket.join(room);
          
          // Send chat history
          const chatHistory = await getRecentMessages(room);
          if (chatHistory.length > 0) {
            pendingSocket.emit('chatHistory', chatHistory);
          }
          
          // Welcome message
          pendingSocket.emit('message', {
            user: 'System',
            text: `Welcome to room ${room}! Your join request was approved.`,
            createdAt: new Date().toISOString()
          });
          
          // Notify the approved user
          pendingSocket.emit('joinApproved', { room });
        }
        
        // Notify room about new user
        socket.to(room).emit('message', {
          user: 'System',
          text: `${user.username} has joined`,
          createdAt: new Date().toISOString()
        });
        socket.to(room).emit('userJoined', user.username);
        
        // Send updated room data
        const roomInfo = await getRoomInfo(room);
        const usersInRoom = await getUsersInRoom(room);
        const adminSocketId = await getRoomAdmin(room);
        const pendingUsers = await getPendingUsers(room);
        
        io.to(room).emit('roomData', {
          room: room,
          users: usersInRoom,
          capacity: roomInfo.capacity,
          available: roomInfo.available,
          isFull: roomInfo.isFull,
          adminId: adminSocketId,
          pendingUsers: pendingUsers
        });
        
        console.log(`✅ Admin approved ${user.username} to join ${room}`);
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('Error in approveJoin:', error);
        if (callback) callback({ error: 'Failed to approve join request' });
      }
    });
    
    // Handle admin rejecting a join request
    socket.on('rejectJoin', async ({ pendingSocketId, room, reason }, callback) => {
      try {
        // Get the current user first
        const currentUser = await getUser(socket.id);
        if (!currentUser) {
          if (callback) callback({ error: 'You are not in a room' });
          return;
        }
        
        // Verify the rejecter is the admin (check by both socket ID and username)
        const isAdmin = await isRoomAdmin(socket.id, room, currentUser.username);
        if (!isAdmin) {
          if (callback) callback({ error: 'Only the admin can reject join requests' });
          return;
        }
        
        // Remove from pending list
        const pendingUser = await removePendingUser(room, pendingSocketId);
        if (!pendingUser) {
          if (callback) callback({ error: 'Pending user not found' });
          return;
        }
        
        // Notify the rejected user
        io.to(pendingSocketId).emit('joinRejected', { 
          reason: reason || 'Your join request was denied by the room admin' 
        });
        
        // Send updated pending list to admin
        const pendingUsers = await getPendingUsers(room);
        socket.emit('pendingUsersUpdate', { pendingUsers });
        
        console.log(`❌ Admin rejected ${pendingUser.username} from joining ${room}`);
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('Error in rejectJoin:', error);
        if (callback) callback({ error: 'Failed to reject join request' });
      }
    });
    
    // Handle user cancelling their join request
    socket.on('cancelJoinRequest', async ({ room }, callback) => {
      try {
        const pendingUser = await removePendingUser(room, socket.id);
        if (pendingUser) {
          // Notify admin about cancellation
          const adminSocketId = await getRoomAdmin(room);
          if (adminSocketId) {
            const pendingUsers = await getPendingUsers(room);
            io.to(adminSocketId).emit('pendingUsersUpdate', { pendingUsers });
          }
          console.log(`🚫 User ${pendingUser.username} cancelled join request for ${room}`);
        }
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('Error in cancelJoinRequest:', error);
        if (callback) callback({ error: 'Failed to cancel join request' });
      }
    });
    
    // Handle admin kicking a user
    socket.on('kickUser', async ({ targetSocketId, room }, callback) => {
      try {
        // Verify the kicker is the admin (by socket ID)
        const isAdmin = await isRoomAdmin(socket.id, room);
        if (!isAdmin) {
          if (callback) callback({ error: 'Only the admin can kick users' });
          return;
        }
        
        // Can't kick yourself
        if (targetSocketId === socket.id) {
          if (callback) callback({ error: 'You cannot kick yourself' });
          return;
        }
        
        // Get the target user info
        const targetUser = await getUser(targetSocketId);
        if (!targetUser || targetUser.room !== room) {
          if (callback) callback({ error: 'User not found in this room' });
          return;
        }
        
        // Remove the user
        await removeUser(targetSocketId);
        
        // Get the target socket and make it leave the room
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.leave(room);
          // Notify the kicked user
          targetSocket.emit('kicked', { reason: 'You have been removed from the room by the admin' });
        }
        
        // Notify room about user removal
        io.to(room).emit('message', {
          user: 'System',
          text: `${targetUser.username} was removed from the room`,
          createdAt: new Date().toISOString()
        });
        io.to(room).emit('userLeft', targetUser.username);
        
        // Send updated room data
        const roomInfo = await getRoomInfo(room);
        const usersInRoom = await getUsersInRoom(room);
        const adminSocketId = await getRoomAdmin(room);
        const pendingUsers = await getPendingUsers(room);
        
        io.to(room).emit('roomData', {
          room: room,
          users: usersInRoom,
          capacity: roomInfo.capacity,
          available: roomInfo.available,
          isFull: roomInfo.isFull,
          adminId: adminSocketId,
          pendingUsers: pendingUsers
        });
        
        console.log(`🚫 Admin kicked ${targetUser.username} from ${room}`);
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('Error in kickUser:', error);
        if (callback) callback({ error: 'Failed to kick user' });
      }
    });
    
    // ==================== END ADMIN APPROVAL HANDLERS ====================
    
    // Handle messages
    socket.on('sendMessage', async (message, callback) => {
      try {
        // Check rate limit for message action
        const rateLimitCheck = checkRateLimit(socket.id, 'message');
        if (!rateLimitCheck.allowed) {
          if (callback) callback({ error: rateLimitCheck.error });
          return;
        }
        
        const user = await getUser(socket.id);
        if (!user) {
          if (callback) callback({ error: 'User not found' });
          return;
        }

        // Validate and sanitize message
        if (!message || typeof message !== 'string') {
          if (callback) callback({ error: 'Invalid message format' });
          return;
        }
        
        // Sanitize the message (checks for XSS and dangerous content)
        const sanitizationResult = sanitizeMessage(message);
        
        if (!sanitizationResult.isValid) {
          console.warn(`⚠️ Invalid message from ${user.username}: ${sanitizationResult.reason}`);
          if (callback) callback({ error: sanitizationResult.reason || 'Invalid message content' });
          return;
        }
        
        const sanitizedMessage = sanitizationResult.sanitized;
        
        // Check message length (after sanitization)
        if (sanitizedMessage.length === 0) {
          if (callback) callback({ error: 'Message cannot be empty' });
          return;
        }
        
        if (sanitizedMessage.length > 1000) {
          if (callback) callback({ error: 'Message too long (max 1000 characters)' });
          return;
        }

        // Create message object with sanitized content
        const messageObj = {
          id: `${socket.id}-${Date.now()}`, // Unique message ID
          user: user.username,
          text: sanitizedMessage,
          createdAt: new Date().toISOString()
        };

        // Save message to Redis for persistence
        await saveMessage(user.room, messageObj);

        // Send to everyone in the room including sender
        io.to(user.room).emit('message', messageObj);
        
        if (callback) callback({ messageId: messageObj.id });
      } catch (error) {
        console.error('Error in sendMessage handler:', error);
        if (callback) callback({ error: 'Failed to send message' });
      }
    });

    // Handle message edit
    socket.on('editMessage', async ({ messageId, newText }, callback) => {
      try {
        const user = await getUser(socket.id);
        if (!user) {
          if (callback) callback({ error: 'User not found' });
          return;
        }

        // 🔴 SECURITY: Verify message ownership (message ID starts with socket.id)
        if (!messageId || !messageId.startsWith(socket.id)) {
          console.warn(`⚠️ Unauthorized edit attempt by ${user.username} on message ${messageId}`);
          if (callback) callback({ error: 'You can only edit your own messages' });
          return;
        }

        // Validate new text
        if (!newText || typeof newText !== 'string') {
          if (callback) callback({ error: 'Invalid message text' });
          return;
        }

        // Sanitize the new message
        const sanitizationResult = sanitizeMessage(newText);
        if (!sanitizationResult.isValid) {
          if (callback) callback({ error: sanitizationResult.reason || 'Invalid message content' });
          return;
        }

        const sanitizedText = sanitizationResult.sanitized;
        if (sanitizedText.length > 1000) {
          if (callback) callback({ error: 'Message too long (max 1000 characters)' });
          return;
        }

        // Update message in Redis (with ownership verification)
        const result = await updateMessageInRedis(user.room, messageId, socket.id, sanitizedText);
        if (!result.success) {
          if (callback) callback({ error: result.error || 'Failed to edit message' });
          return;
        }

        // Broadcast edit to all users in room
        io.to(user.room).emit('messageEdited', {
          messageId,
          newText: sanitizedText,
          editedAt: new Date().toISOString()
        });

        if (callback) callback({ success: true });
      } catch (error) {
        console.error('Error in editMessage handler:', error);
        if (callback) callback({ error: 'Failed to edit message' });
      }
    });

    // Handle message delete
    socket.on('deleteMessage', async (messageId, callback) => {
      try {
        const user = await getUser(socket.id);
        if (!user) {
          if (callback) callback({ error: 'User not found' });
          return;
        }

        // 🔴 SECURITY: Verify message ownership (message ID starts with socket.id)
        if (!messageId || !messageId.startsWith(socket.id)) {
          console.warn(`⚠️ Unauthorized delete attempt by ${user.username} on message ${messageId}`);
          if (callback) callback({ error: 'You can only delete your own messages' });
          return;
        }

        // Delete message from Redis (with ownership verification)
        const result = await deleteMessageFromRedis(user.room, messageId, socket.id);
        if (!result.success) {
          if (callback) callback({ error: result.error || 'Failed to delete message' });
          return;
        }

        // Broadcast delete to all users in room
        io.to(user.room).emit('messageDeleted', { messageId });

        if (callback) callback({ success: true });
      } catch (error) {
        console.error('Error in deleteMessage handler:', error);
        if (callback) callback({ error: 'Failed to delete message' });
      }
    });

    // Handle file/image sharing
    socket.on('sendFile', async (fileData, callback) => {
      try {
        // Check rate limit for message action (files count as messages)
        const rateLimitCheck = checkRateLimit(socket.id, 'message');
        if (!rateLimitCheck.allowed) {
          if (callback) callback({ error: rateLimitCheck.error });
          return;
        }
        
        const user = await getUser(socket.id);
        if (!user) {
          if (callback) callback({ error: 'User not found' });
          return;
        }

        // Validate file data structure
        if (!fileData || typeof fileData !== 'object') {
          if (callback) callback({ error: 'Invalid file data' });
          return;
        }

        const { fileName, fileType, fileSize, fileData: base64Data } = fileData;

        // Validate required fields
        if (!fileName || !fileType || !base64Data) {
          if (callback) callback({ error: 'Missing file information' });
          return;
        }

        // Sanitize filename
        const sanitizedFileName = fileName
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .substring(0, 100);

        // Validate file size (max 5MB)
        const maxFileSize = 5 * 1024 * 1024; // 5MB
        if (fileSize > maxFileSize) {
          if (callback) callback({ error: 'File too large. Maximum size is 5MB.' });
          return;
        }

        // Validate file type (allow common image and document types)
        const allowedTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!allowedTypes.includes(fileType)) {
          if (callback) callback({ error: 'File type not allowed. Supported: images, PDF, text, Word documents.' });
          return;
        }

        // Check if it's an image
        const isImage = fileType.startsWith('image/');

        // Create file message object for broadcasting (includes base64 data)
        const fileMessageForBroadcast = {
          id: `${socket.id}-${Date.now()}`, // Unique message ID
          user: user.username,
          type: 'file',
          fileName: sanitizedFileName,
          fileType: fileType,
          fileSize: fileSize,
          fileData: base64Data, // Include base64 for real-time broadcast
          isImage: isImage,
          createdAt: new Date().toISOString()
        };

        // Save file message to Redis (WITHOUT base64 data to save memory)
        // The messageService will strip fileData automatically
        await saveMessage(user.room, fileMessageForBroadcast);

        // Send to everyone in the room including sender (WITH base64 data)
        io.to(user.room).emit('message', fileMessageForBroadcast);
        
        console.log(`📁 File shared by ${user.username}: ${sanitizedFileName} (${(fileSize / 1024).toFixed(1)}KB)`);
        
        if (callback) callback({ success: true, messageId: fileMessageForBroadcast.id });
      } catch (error) {
        console.error('Error in sendFile handler:', error);
        if (callback) callback({ error: 'Failed to send file' });
      }
    });
    
    // Handle typing indicator
    socket.on('typing', async () => {
      try {
        const user = await getUser(socket.id);
        if (user) {
          // Broadcast to other users in the room (not to self)
          socket.to(user.room).emit('userTyping', user.username);
        }
      } catch (error) {
        console.error('Error in typing handler:', error);
      }
    });
    
    // Handle stop typing indicator
    socket.on('stopTyping', async () => {
      try {
        const user = await getUser(socket.id);
        if (user) {
          // Broadcast to other users in the room (not to self)
          socket.to(user.room).emit('userStoppedTyping', user.username);
        }
      } catch (error) {
        console.error('Error in stopTyping handler:', error);
      }
    });
    
    // Handle user explicitly leaving
    socket.on('leaveRoom', async () => {
      // Prevent duplicate processing
      if (recentlyRemovedUsers.has(socket.id)) {
        return;
      }
      recentlyRemovedUsers.add(socket.id);
      
      const user = await removeUser(socket.id);
      
      if (user) {
        await handleUserLeaving(socket, user);
      }
      
      // Clean up after a short delay
      setTimeout(() => recentlyRemovedUsers.delete(socket.id), 5000);
    });
    
    // Handle disconnects (browser close, etc.)
    socket.on('disconnect', async () => {
      console.log(`Connection disconnected: ${socket.id}`);
      
      // Clean up rate limit data for this socket
      cleanupRateLimit(socket.id);
      
      // Prevent duplicate processing
      if (recentlyRemovedUsers.has(socket.id)) {
        recentlyRemovedUsers.delete(socket.id);
        return;
      }
      recentlyRemovedUsers.add(socket.id);
      
      const user = await removeUser(socket.id);
      
      if (user) {
        await handleUserLeaving(socket, user);
      }
      
      // Clean up after a short delay
      setTimeout(() => recentlyRemovedUsers.delete(socket.id), 5000);
    });
  });

  // Helper function for handling a user leaving
  const handleUserLeaving = async (socket, user) => {
    // Check if the leaving user was the admin (by socket ID)
    const wasAdmin = await isRoomAdmin(socket.id, user.room);
    
    // Notify other users in the room
    socket.to(user.room).emit('message', {
      user: 'System',
      text: `${user.username} has left`,
      createdAt: new Date().toISOString()
    });

    // Notify for toast
    socket.to(user.room).emit('userLeft', user.username);

    // Get updated room info
    const roomInfo = await getRoomInfo(user.room);
    const usersInRoom = await getUsersInRoom(user.room);
    
    // Check if room requires admin (no transfer mode)
    const roomRequiresAdmin = await isRoomAdminRequired(user.room);
    
    // If the admin left and room doesn't require admin, transfer to another user
    let newAdminId = await getRoomAdmin(user.room);
    if (wasAdmin && usersInRoom.length > 0 && !roomRequiresAdmin) {
      // Transfer admin to first remaining user (generates new token for them)
      const newAdmin = usersInRoom[0];
      const transferResult = await transferAdmin(user.room, newAdmin.id);
      newAdminId = newAdmin.id;
      
      // Notify new admin with their new token
      io.to(newAdmin.id).emit('adminStatus', { 
        isAdmin: true,
        adminToken: transferResult.adminToken
      });
      io.to(user.room).emit('message', {
        user: 'System',
        text: `${newAdmin.username} is now the room admin`,
        createdAt: new Date().toISOString()
      });
      
      console.log(`👑 Admin transferred to ${newAdmin.username} in room ${user.room}`);
    } else if (wasAdmin && roomRequiresAdmin) {
      // Admin left but room requires the creator - admin stays with token holder
      console.log(`🔒 Admin left room ${user.room} but admin control is locked to creator`);
    }
    
    // Get pending users for room data
    const pendingUsers = await getPendingUsers(user.room);
    
    // Send updated room data (including capacity info and admin)
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: usersInRoom,
      capacity: roomInfo.capacity,
      available: roomInfo.available,
      isFull: roomInfo.isFull,
      adminId: newAdminId,
      pendingUsers: pendingUsers
    });

    // If room is now empty, schedule cleanup
    if (usersInRoom.length === 0) {
      console.log(`Room ${user.room} is now empty, scheduling cleanup in 10 minutes`);
      
      // Clear any pending join requests
      await clearPendingUsers(user.room);
      
      // Schedule room cleanup with message erasure
      scheduleRoomCleanup(user.room, async (roomId) => {
        // Erase all messages when room is cleaned up
        const cleared = await clearRoomMessages(roomId);
        if (cleared) {
          console.log(`🗑️ Messages erased for room ${roomId}`);
        }
      });
    }
  };

  return io;
};

module.exports = { setupSocketHandlers };