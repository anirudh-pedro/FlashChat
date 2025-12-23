/**
 * User Manager - Redis-based user/room persistence
 * 
 * Schema:
 * - user:<socketId>        → HASH { username, room, joinedAt }
 * - room:<roomId>:users    → SET of socketIds
 * - room:<roomId>:meta     → HASH { createdAt, lastActivity, admin }
 * - room:<roomId>:pending  → SET of JSON-stringified pending users
 * 
 * Benefits:
 * - Users survive server restart (if they reconnect)
 * - Room state is persistent
 * - Horizontal scaling ready (multiple server instances)
 * - Admin approval system for room access
 */

const { getRedisClient, isRedisConnected } = require('../src/config/redis');

// Configuration
const ROOM_CAPACITY = {
  DEFAULT: 50,
  LOCATION: 100,
  MIN_CAPACITY: 2,
  MAX_CAPACITY: 100
};

const USER_TTL = 24 * 60 * 60;        // 24 hours - user data expiry
const ROOM_TTL = 7 * 24 * 60 * 60;    // 7 days - room data expiry
const ROOM_CLEANUP_DELAY = 10 * 60 * 1000; // 10 minutes - room cleanup after empty

// ==================== KEY GENERATORS ====================

const keys = {
  user: (socketId) => `user:${socketId}`,
  roomUsers: (roomId) => `room:${roomId}:users`,
  roomMeta: (roomId) => `room:${roomId}:meta`,
  roomPending: (roomId) => `room:${roomId}:pending`
};

// In-memory cleanup timers for rooms (when empty)
const roomCleanupTimers = new Map();

// ==================== USER OPERATIONS ====================

/**
 * Add a new user to Redis
 * @param {Object} userInfo - { id: socketId, username, room }
 * @returns {Promise<{user?: Object, error?: string}>}
 */
const addUser = async ({ id, username, room }) => {
  // Validate inputs
  if (!username || !room) {
    return { error: 'Username and room are required!' };
  }

  // Normalize inputs
  username = username.trim().toLowerCase();
  room = room.trim().toUpperCase();

  // Fallback to in-memory if Redis not connected
  if (!isRedisConnected()) {
    console.warn('⚠️ Redis not connected, using in-memory fallback');
    return addUserInMemory({ id, username, room });
  }

  try {
    const redis = getRedisClient();

    // Check room capacity
    const capacityCheck = await checkRoomCapacity(room);
    if (capacityCheck.isFull) {
      console.log(`🚫 Room ${room} is full (${capacityCheck.current}/${capacityCheck.limit} users)`);
      return { error: `Room is full! Maximum capacity: ${capacityCheck.limit} users.` };
    }

    // Check if username is already taken in the room
    const roomUsersKey = keys.roomUsers(room);
    const existingUsers = await redis.sMembers(roomUsersKey);
    
    for (const odId of existingUsers) {
      const existingUser = await redis.hGetAll(keys.user(odId));
      if (existingUser && existingUser.username === username) {
        return { error: 'Username is already taken in this room!' };
      }
    }

    // Store user data
    const userKey = keys.user(id);
    const userData = {
      id,
      username,
      room,
      joinedAt: new Date().toISOString()
    };

    await redis.hSet(userKey, userData);
    await redis.expire(userKey, USER_TTL);

    // Add user to room's user set
    await redis.sAdd(roomUsersKey, id);
    await redis.expire(roomUsersKey, ROOM_TTL);

    // Update room metadata - first user becomes admin
    const roomMetaKey = keys.roomMeta(room);
    const roomMeta = await redis.hGetAll(roomMetaKey);
    
    const isNewRoom = !roomMeta || !roomMeta.createdAt;
    const isAdmin = isNewRoom || !roomMeta.admin;
    
    if (isNewRoom) {
      await redis.hSet(roomMetaKey, {
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        admin: id // First user is the admin
      });
    } else {
      await redis.hSet(roomMetaKey, 'lastActivity', new Date().toISOString());
      // If no admin set, make this user admin
      if (!roomMeta.admin) {
        await redis.hSet(roomMetaKey, 'admin', id);
      }
    }
    await redis.expire(roomMetaKey, ROOM_TTL);

    // Clear any cleanup timer for this room
    if (roomCleanupTimers.has(room)) {
      clearTimeout(roomCleanupTimers.get(room));
      roomCleanupTimers.delete(room);
      console.log(`⏰ Cancelled cleanup timer for room ${room}`);
    }

    // Log
    const updatedCapacity = await checkRoomCapacity(room);
    console.log(`✅ User ${username} joined ${room} (${updatedCapacity.current}/${updatedCapacity.limit} users)${isAdmin ? ' [ADMIN]' : ''}`);

    return { user: { id, username, room, isAdmin } };
  } catch (error) {
    console.error('❌ Error adding user to Redis:', error.message);
    // Fallback to in-memory
    return addUserInMemory({ id, username, room });
  }
};

/**
 * Remove a user from Redis
 * @param {string} id - Socket ID
 * @returns {Promise<Object|null>} - Removed user or null
 */
const removeUser = async (id) => {
  if (!isRedisConnected()) {
    return removeUserInMemory(id);
  }

  try {
    const redis = getRedisClient();
    const userKey = keys.user(id);

    // Get user data before removing
    const userData = await redis.hGetAll(userKey);
    
    if (!userData || !userData.username) {
      // Try in-memory fallback
      return removeUserInMemory(id);
    }

    const user = {
      id: userData.id || id,
      username: userData.username,
      room: userData.room
    };

    // Remove user from room's user set
    if (user.room) {
      await redis.sRem(keys.roomUsers(user.room), id);
      
      // Update room last activity
      await redis.hSet(keys.roomMeta(user.room), 'lastActivity', new Date().toISOString());
    }

    // Delete user data
    await redis.del(userKey);

    console.log(`👋 User ${user.username} left ${user.room}`);
    return user;
  } catch (error) {
    console.error('❌ Error removing user from Redis:', error.message);
    return removeUserInMemory(id);
  }
};

/**
 * Get a user by socket ID
 * @param {string} id - Socket ID
 * @returns {Promise<Object|null>}
 */
const getUser = async (id) => {
  if (!isRedisConnected()) {
    return getUserInMemory(id);
  }

  try {
    const redis = getRedisClient();
    const userData = await redis.hGetAll(keys.user(id));
    
    if (!userData || !userData.username) {
      return getUserInMemory(id);
    }

    return {
      id: userData.id || id,
      username: userData.username,
      room: userData.room
    };
  } catch (error) {
    console.error('❌ Error getting user from Redis:', error.message);
    return getUserInMemory(id);
  }
};

/**
 * Get all users in a room
 * @param {string} room - Room ID
 * @returns {Promise<Array>}
 */
const getUsersInRoom = async (room) => {
  room = room.trim().toUpperCase();

  if (!isRedisConnected()) {
    return getUsersInRoomInMemory(room);
  }

  try {
    const redis = getRedisClient();
    const userIds = await redis.sMembers(keys.roomUsers(room));
    
    const users = [];
    for (const odId of userIds) {
      const userData = await redis.hGetAll(keys.user(odId));
      if (userData && userData.username) {
        users.push({
          id: userData.id || odId,
          username: userData.username,
          room: userData.room
        });
      } else {
        // Clean up stale reference
        await redis.sRem(keys.roomUsers(room), odId);
      }
    }

    return users;
  } catch (error) {
    console.error('❌ Error getting room users from Redis:', error.message);
    return getUsersInRoomInMemory(room);
  }
};

/**
 * Get room user count
 * @param {string} room - Room ID
 * @returns {Promise<number>}
 */
const getRoomCount = async (room) => {
  const users = await getUsersInRoom(room);
  return users.length;
};

/**
 * Check room capacity
 * @param {string} room - Room ID
 * @returns {Promise<Object>}
 */
const checkRoomCapacity = async (room) => {
  const users = await getUsersInRoom(room);
  const currentUsers = users.length;

  const isLocationRoom = room.startsWith('LOC_');
  const capacity = isLocationRoom ? ROOM_CAPACITY.LOCATION : ROOM_CAPACITY.DEFAULT;

  return {
    isFull: currentUsers >= capacity,
    current: currentUsers,
    limit: capacity,
    available: capacity - currentUsers
  };
};

/**
 * Get room info including users and capacity
 * @param {string} room - Room ID
 * @returns {Promise<Object>}
 */
const getRoomInfo = async (room) => {
  const users = await getUsersInRoom(room);
  const capacity = await checkRoomCapacity(room);

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
 * Check if room is active (has users)
 * @param {string} room - Room ID
 * @returns {Promise<boolean>}
 */
const isRoomActive = async (room) => {
  if (!isRedisConnected()) {
    return isRoomActiveInMemory(room);
  }

  try {
    const redis = getRedisClient();
    const count = await redis.sCard(keys.roomUsers(room));
    return count > 0;
  } catch (error) {
    return isRoomActiveInMemory(room);
  }
};

/**
 * Reattach user on reconnect (update socket ID)
 * @param {string} oldSocketId - Previous socket ID
 * @param {string} newSocketId - New socket ID
 * @param {string} username - Username
 * @param {string} room - Room ID
 * @returns {Promise<{user?: Object, error?: string}>}
 */
const reattachUser = async (oldSocketId, newSocketId, username, room) => {
  // Remove old socket reference if exists
  await removeUser(oldSocketId);
  
  // Add with new socket ID
  return addUser({ id: newSocketId, username, room });
};

// ==================== IN-MEMORY FALLBACK ====================
// Used when Redis is not connected

const inMemoryUsers = [];
const inMemoryRooms = new Map();

const addUserInMemory = ({ id, username, room }) => {
  username = username.trim().toLowerCase();
  room = room.trim().toUpperCase();

  const existingUser = inMemoryUsers.find(u => u.room === room && u.username === username);
  if (existingUser) {
    return { error: 'Username is already taken in this room!' };
  }

  const user = { id, username, room };
  inMemoryUsers.push(user);

  if (!inMemoryRooms.has(room)) {
    inMemoryRooms.set(room, { userCount: 0 });
  }
  inMemoryRooms.get(room).userCount++;

  return { user };
};

const removeUserInMemory = (id) => {
  const index = inMemoryUsers.findIndex(u => u.id === id);
  if (index === -1) return null;

  const user = inMemoryUsers.splice(index, 1)[0];
  
  if (user.room && inMemoryRooms.has(user.room)) {
    inMemoryRooms.get(user.room).userCount--;
  }

  return user;
};

const getUserInMemory = (id) => {
  return inMemoryUsers.find(u => u.id === id) || null;
};

const getUsersInRoomInMemory = (room) => {
  return inMemoryUsers.filter(u => u.room === room);
};

const isRoomActiveInMemory = (room) => {
  return inMemoryRooms.has(room) && inMemoryRooms.get(room).userCount > 0;
};

// ==================== CLEANUP ====================

/**
 * Cleanup function for graceful shutdown
 */
const cleanupAllTimers = () => {
  console.log('Cleaning up all room timers...');
  inMemoryRooms.clear();
  inMemoryUsers.length = 0;
  console.log('Cleared 0 pending cleanup timers');
};

/**
 * Get all active room IDs
 * @returns {Promise<Array>}
 */
const getActiveRoomIds = async () => {
  if (!isRedisConnected()) {
    return Array.from(inMemoryRooms.keys());
  }

  try {
    const redis = getRedisClient();
    const roomKeys = await redis.keys('room:*:users');
    return roomKeys.map(key => key.replace('room:', '').replace(':users', ''));
  } catch (error) {
    return Array.from(inMemoryRooms.keys());
  }
};

// ==================== ADMIN FUNCTIONS ====================

/**
 * Check if a user is the admin of a room
 * @param {string} socketId - Socket ID
 * @param {string} room - Room ID
 * @returns {Promise<boolean>}
 */
const isRoomAdmin = async (socketId, room) => {
  room = room.trim().toUpperCase();
  
  if (!isRedisConnected()) {
    // In-memory fallback
    const roomData = inMemoryRooms.get(room);
    return roomData && roomData.admin === socketId;
  }

  try {
    const redis = getRedisClient();
    const roomMeta = await redis.hGetAll(keys.roomMeta(room));
    return roomMeta && roomMeta.admin === socketId;
  } catch (error) {
    console.error('❌ Error checking room admin:', error.message);
    return false;
  }
};

/**
 * Get admin socket ID of a room
 * @param {string} room - Room ID
 * @returns {Promise<string|null>}
 */
const getRoomAdmin = async (room) => {
  room = room.trim().toUpperCase();
  
  if (!isRedisConnected()) {
    const roomData = inMemoryRooms.get(room);
    return roomData ? roomData.admin : null;
  }

  try {
    const redis = getRedisClient();
    const roomMeta = await redis.hGetAll(keys.roomMeta(room));
    return roomMeta ? roomMeta.admin : null;
  } catch (error) {
    console.error('❌ Error getting room admin:', error.message);
    return null;
  }
};

/**
 * Transfer admin to another user
 * @param {string} room - Room ID
 * @param {string} newAdminId - New admin's socket ID
 * @returns {Promise<boolean>}
 */
const transferAdmin = async (room, newAdminId) => {
  room = room.trim().toUpperCase();
  
  if (!isRedisConnected()) {
    const roomData = inMemoryRooms.get(room);
    if (roomData) {
      roomData.admin = newAdminId;
      return true;
    }
    return false;
  }

  try {
    const redis = getRedisClient();
    await redis.hSet(keys.roomMeta(room), 'admin', newAdminId);
    return true;
  } catch (error) {
    console.error('❌ Error transferring admin:', error.message);
    return false;
  }
};

// ==================== PENDING USERS FUNCTIONS ====================

/**
 * Add a user to pending list
 * @param {string} room - Room ID
 * @param {Object} pendingUser - { socketId, username }
 * @returns {Promise<boolean>}
 */
const addPendingUser = async (room, pendingUser) => {
  room = room.trim().toUpperCase();
  
  if (!isRedisConnected()) {
    // In-memory fallback
    if (!inMemoryRooms.has(room)) {
      inMemoryRooms.set(room, { userCount: 0, pending: [] });
    }
    const roomData = inMemoryRooms.get(room);
    if (!roomData.pending) roomData.pending = [];
    roomData.pending.push(pendingUser);
    return true;
  }

  try {
    const redis = getRedisClient();
    await redis.sAdd(keys.roomPending(room), JSON.stringify(pendingUser));
    await redis.expire(keys.roomPending(room), ROOM_TTL);
    return true;
  } catch (error) {
    console.error('❌ Error adding pending user:', error.message);
    return false;
  }
};

/**
 * Get all pending users for a room
 * @param {string} room - Room ID
 * @returns {Promise<Array>}
 */
const getPendingUsers = async (room) => {
  room = room.trim().toUpperCase();
  
  if (!isRedisConnected()) {
    const roomData = inMemoryRooms.get(room);
    return roomData && roomData.pending ? roomData.pending : [];
  }

  try {
    const redis = getRedisClient();
    const pendingData = await redis.sMembers(keys.roomPending(room));
    return pendingData.map(json => {
      try {
        return JSON.parse(json);
      } catch (e) {
        return null;
      }
    }).filter(p => p !== null);
  } catch (error) {
    console.error('❌ Error getting pending users:', error.message);
    return [];
  }
};

/**
 * Remove a user from pending list
 * @param {string} room - Room ID
 * @param {string} socketId - Socket ID of the pending user
 * @returns {Promise<Object|null>} - Removed pending user or null
 */
const removePendingUser = async (room, socketId) => {
  room = room.trim().toUpperCase();
  
  if (!isRedisConnected()) {
    const roomData = inMemoryRooms.get(room);
    if (roomData && roomData.pending) {
      const index = roomData.pending.findIndex(p => p.socketId === socketId);
      if (index !== -1) {
        return roomData.pending.splice(index, 1)[0];
      }
    }
    return null;
  }

  try {
    const redis = getRedisClient();
    const pendingData = await redis.sMembers(keys.roomPending(room));
    
    for (const json of pendingData) {
      try {
        const pending = JSON.parse(json);
        if (pending.socketId === socketId) {
          await redis.sRem(keys.roomPending(room), json);
          return pending;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
    return null;
  } catch (error) {
    console.error('❌ Error removing pending user:', error.message);
    return null;
  }
};

/**
 * Clear all pending users for a room
 * @param {string} room - Room ID
 * @returns {Promise<boolean>}
 */
const clearPendingUsers = async (room) => {
  room = room.trim().toUpperCase();
  
  if (!isRedisConnected()) {
    const roomData = inMemoryRooms.get(room);
    if (roomData) {
      roomData.pending = [];
    }
    return true;
  }

  try {
    const redis = getRedisClient();
    await redis.del(keys.roomPending(room));
    return true;
  } catch (error) {
    console.error('❌ Error clearing pending users:', error.message);
    return false;
  }
};

// ==================== ROOM CLEANUP FUNCTIONS ====================

/**
 * Schedule room cleanup (called when room becomes empty)
 * @param {string} room - Room ID
 * @param {Function} onCleanup - Callback when room is cleaned up
 */
const scheduleRoomCleanup = (room, onCleanup) => {
  room = room.trim().toUpperCase();
  
  // Clear any existing timer
  if (roomCleanupTimers.has(room)) {
    clearTimeout(roomCleanupTimers.get(room));
  }
  
  console.log(`⏰ Scheduling cleanup for room ${room} in 10 minutes`);
  
  const timer = setTimeout(async () => {
    const usersInRoom = await getUsersInRoom(room);
    
    if (usersInRoom.length === 0) {
      console.log(`🗑️ Cleaning up empty room ${room} after 10 minutes`);
      
      // Call cleanup callback (to erase messages)
      if (onCleanup) {
        await onCleanup(room);
      }
      
      // Clean up Redis keys
      if (isRedisConnected()) {
        try {
          const redis = getRedisClient();
          await redis.del(keys.roomMeta(room));
          await redis.del(keys.roomUsers(room));
          await redis.del(keys.roomPending(room));
        } catch (error) {
          console.error('❌ Error cleaning up room keys:', error.message);
        }
      }
      
      // Clean up in-memory
      inMemoryRooms.delete(room);
      roomCleanupTimers.delete(room);
    }
  }, ROOM_CLEANUP_DELAY);
  
  roomCleanupTimers.set(room, timer);
};

/**
 * Cancel scheduled room cleanup
 * @param {string} room - Room ID
 */
const cancelRoomCleanup = (room) => {
  room = room.trim().toUpperCase();
  
  if (roomCleanupTimers.has(room)) {
    clearTimeout(roomCleanupTimers.get(room));
    roomCleanupTimers.delete(room);
    console.log(`⏰ Cancelled cleanup timer for room ${room}`);
  }
};

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
  reattachUser,
  cleanupAllTimers,
  // Admin functions
  isRoomAdmin,
  getRoomAdmin,
  transferAdmin,
  // Pending user functions
  addPendingUser,
  getPendingUsers,
  removePendingUser,
  clearPendingUsers,
  // Room cleanup
  scheduleRoomCleanup,
  cancelRoomCleanup,
  ROOM_CAPACITY,
  ROOM_CLEANUP_DELAY
};
