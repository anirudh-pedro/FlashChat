// In-memory storage for users
const users = [];

// Add these variables at the top of the file
const rooms = new Map(); // To track all active rooms
const ROOM_CLEANUP_DELAY = 30 * 60 * 1000; // 30 minutes in milliseconds

// ==================== ROOM CAPACITY LIMITS ====================
/**
 * Room capacity configuration
 * Different room types can have different limits
 */
const ROOM_CAPACITY = {
  DEFAULT: 50,        // Default capacity for regular rooms
  LOCATION: 100,      // Location-based rooms can have more users
  MIN_CAPACITY: 2,    // Minimum users needed for a room
  MAX_CAPACITY: 100   // Hard limit across all room types
};

/**
 * Check if room has reached capacity
 * @param {string} roomId - Room ID to check
 * @returns {Object} - { isFull: boolean, current: number, limit: number }
 */
const checkRoomCapacity = (roomId) => {
  const currentUsers = getUsersInRoom(roomId).length;
  
  // Determine capacity based on room type
  const isLocationRoom = roomId.startsWith('LOC_');
  const capacity = isLocationRoom ? ROOM_CAPACITY.LOCATION : ROOM_CAPACITY.DEFAULT;
  
  return {
    isFull: currentUsers >= capacity,
    current: currentUsers,
    limit: capacity,
    available: capacity - currentUsers
  };
};

// ==================== END ROOM CAPACITY LIMITS ====================

/**
 * Add a new user to the in-memory storage
 * @param {Object} userInfo - User information
 * @param {string} userInfo.id - Socket ID
 * @param {string} userInfo.username - User's display name (should already be normalized)
 * @param {string} userInfo.room - Room ID
 * @returns {Object} - User object or error
 */
const addUser = ({ id, username, room }) => {
  // Validate inputs
  if (!username || !room) {
    return { error: 'Username and room are required!' };
  }
  
  // Normalize inputs - username should already be lowercase from client
  username = username.trim().toLowerCase();
  room = room.trim().toUpperCase();
  
  // Check room capacity before adding user
  const capacityCheck = checkRoomCapacity(room);
  if (capacityCheck.isFull) {
    console.log(`🚫 Room ${room} is full (${capacityCheck.current}/${capacityCheck.limit} users)`);
    return { 
      error: `Room is full! Maximum capacity: ${capacityCheck.limit} users. Please try another room.` 
    };
  }
  
  // Check if username is already taken in the room
  const existingUser = users.find(user => user.room === room && user.username === username);
  if (existingUser) {
    return { error: 'Username is already taken in this room!' };
  }
  
  // Create user and add to users array
  const user = { id, username, room };
  users.push(user);
  
  // Track room activity
  trackRoom(room);
  
  // Log capacity info
  const updatedCapacity = checkRoomCapacity(room);
  console.log(`✅ User ${username} joined ${room} (${updatedCapacity.current}/${updatedCapacity.limit} users)`);
  
  return { user };
};

/**
 * Remove a user from storage
 * @param {string} id - Socket ID
 * @returns {Object|undefined} - Removed user or undefined
 */
const removeUser = (id) => {
  const index = users.findIndex(user => user.id === id);
  
  if (index === -1) {
    return null;
  }
  
  const user = users.splice(index, 1)[0];
  
  // Update room user count and setup cleanup if needed
  if (user && user.room && rooms.has(user.room)) {
    const roomData = rooms.get(user.room);
    
    // Clear any existing cleanup timer first to prevent memory leaks
    if (roomData.cleanupTimer) {
      clearTimeout(roomData.cleanupTimer);
      roomData.cleanupTimer = null;
    }
    
    roomData.userCount -= 1;
    
    // If no users left in the room, schedule cleanup
    if (roomData.userCount <= 0) {
      console.log(`Room ${user.room} is empty. Scheduling cleanup in ${ROOM_CLEANUP_DELAY/60000} minutes.`);
      
      roomData.cleanupTimer = setTimeout(() => {
        // Double-check: verify the room still exists and is still empty before removing
        const currentRoomData = rooms.get(user.room);
        if (currentRoomData && currentRoomData.userCount <= 0) {
          console.log(`Cleaning up inactive room: ${user.room}`);
          
          // Clear the timer reference before deleting
          if (currentRoomData.cleanupTimer) {
            clearTimeout(currentRoomData.cleanupTimer);
          }
          
          rooms.delete(user.room);
        }
      }, ROOM_CLEANUP_DELAY);
    }
  }
  
  return user;
};

/**
 * Get a user by socket ID
 * @param {string} id - Socket ID
 * @returns {Object|undefined} - User object or undefined
 */
const getUser = (id) => {
  return users.find((user) => user.id === id);
};

/**
 * Get all users in a specific room
 * @param {string} room - Room ID
 * @returns {Array} - Array of users
 */
const getUsersInRoom = (room) => {
  return users.filter((user) => user.room === room);
};

/**
 * Get count of users in a room
 * @param {string} room - Room ID
 * @returns {number} - Number of users
 */
const getRoomCount = (room) => {
  return getUsersInRoom(room).length;
};

/**
 * Get room info including capacity
 * @param {string} room - Room ID
 * @returns {Object} - Room information with capacity details
 */
const getRoomInfo = (room) => {
  const users = getUsersInRoom(room);
  const capacity = checkRoomCapacity(room);
  
  return {
    room,
    userCount: users.length,
    users,
    capacity: capacity.limit,
    available: capacity.available,
    isFull: capacity.isFull
  };
};

/**
 * Get list of all active rooms
 * @returns {Array} - Array of room IDs with user counts
 */
const getActiveRooms = () => {
  const rooms = {};
  
  users.forEach(user => {
    if (!rooms[user.room]) {
      rooms[user.room] = 0;
    }
    rooms[user.room]++;
  });
  
  return Object.entries(rooms).map(([id, userCount]) => ({ id, userCount }));
};

// Modify or add this function to track room timers
const trackRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      createdAt: new Date(),
      cleanupTimer: null,
      userCount: 0,
    });
  }
  
  const roomData = rooms.get(roomId);
  roomData.userCount += 1;
  
  // Clear any existing cleanup timer when a user joins
  // This prevents the room from being deleted while users are joining
  if (roomData.cleanupTimer) {
    console.log(`Clearing cleanup timer for room ${roomId} - user rejoining`);
    clearTimeout(roomData.cleanupTimer);
    roomData.cleanupTimer = null;
  }
};

/**
 * Cleanup function to clear all timers (useful for graceful shutdown)
 */
const cleanupAllTimers = () => {
  console.log('Cleaning up all room timers...');
  let timerCount = 0;
  
  rooms.forEach((roomData, roomId) => {
    if (roomData.cleanupTimer) {
      clearTimeout(roomData.cleanupTimer);
      roomData.cleanupTimer = null;
      timerCount++;
    }
  });
  
  console.log(`Cleared ${timerCount} pending cleanup timers`);
  rooms.clear();
  users.length = 0; // Clear users array
};

// Add this function to check if a room exists and is active
const isRoomActive = (roomId) => {
  return rooms.has(roomId);
};

// Add this function to get all active room IDs
const getActiveRoomIds = () => {
  return Array.from(rooms.keys());
};

// Update exports to include new functions
module.exports = {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
  getRoomCount,
  getRoomInfo,
  checkRoomCapacity,
  isRoomActive,
  getActiveRoomIds,
  cleanupAllTimers,
  ROOM_CAPACITY
};