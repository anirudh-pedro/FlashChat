/**
 * Message Service - Redis-based message persistence
 * 
 * Schema:
 * - room:<roomId>:messages → LIST of JSON-stringified messages
 * - Each message: { id visibleId, ownerId mod, user, text, type, createdAt, ... }
 * 
 * IMPORTANT: File messages store metadata only (no base64 data)
 * Files are broadcast in real-time but not persisted to save Redis memory
 */

const { getRedisClient, isRedisConnected } = require('../config/redis');

// Configuration
const MAX_MESSAGES_PER_ROOM = 100;  // Store last 100 messages per room
const MESSAGES_TO_FETCH = 50;       // Fetch last 50 messages on join
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Get Redis key for room messages
 * @param {string} roomId - Room ID
 * @returns {string} - Redis key
 */
const getRoomMessagesKey = (roomId) => {
  return `room:${roomId}:messages`;
};

/**
 * Refresh TTL on room activity
 * @param {string} roomId - Room ID
 */
const refreshRoomTTL = async (roomId) => {
  if (!isRedisConnected()) return;
  
  try {
    const redis = getRedisClient();
    const key = getRoomMessagesKey(roomId);
    await redis.expire(key, TTL_SECONDS);
  } catch (error) {
    // Silent fail - TTL refresh is not critical
  }
};

/**
 * Save a message to Redis
 * NOTE: For file messages, only metadata is stored (no base64 data)
 * @param {string} roomId - Room ID
 * @param {Object} message - Message object
 * @returns {Promise<boolean>} - Success status
 */
const saveMessage = async (roomId, message) => {
  if (!isRedisConnected()) {
    console.warn('⚠️ Redis not connected, message not persisted');
    return false;
  }

  try {
    const redis = getRedisClient();
    const key = getRoomMessagesKey(roomId);
    
    // For file messages, strip base64 data to save Redis memory
    let messageToStore = message;
    if (message.type === 'file') {
      // Store only metadata, not the actual file data
      messageToStore = {
        ...message,
        fileData: null, // Don't store base64 in Redis
        isExpired: false // Mark that file data is not available
      };
    }
    
    // Serialize message to JSON
    const messageJson = JSON.stringify(messageToStore);
    
    // RPUSH: Add message to end of list
    await redis.rPush(key, messageJson);
    
    // LTRIM: Keep only last MAX_MESSAGES_PER_ROOM messages
    await redis.lTrim(key, -MAX_MESSAGES_PER_ROOM, -1);
    
    // Refresh TTL on activity
    await redis.expire(key, TTL_SECONDS);
    
    return true;
  } catch (error) {
    console.error('❌ Error saving message to Redis:', error.message);
    return false;
  }
};

/**
 * Get recent messages from a room
 * @param {string} roomId - Room ID
 * @param {number} count - Number of messages to fetch (default: MESSAGES_TO_FETCH)
 * @returns {Promise<Array>} - Array of message objects
 */
const getRecentMessages = async (roomId, count = MESSAGES_TO_FETCH) => {
  if (!isRedisConnected()) {
    console.warn('⚠️ Redis not connected, cannot fetch messages');
    return [];
  }

  try {
    const redis = getRedisClient();
    const key = getRoomMessagesKey(roomId);
    
    // LRANGE: Get last 'count' messages
    // -count to -1 means "last count elements"
    const messagesJson = await redis.lRange(key, -count, -1);
    
    // Parse JSON strings back to objects
    const messages = messagesJson.map(json => {
      try {
        return JSON.parse(json);
      } catch (e) {
        console.error('❌ Error parsing message JSON:', e.message);
        return null;
      }
    }).filter(msg => msg !== null);
    
    return messages;
  } catch (error) {
    console.error('❌ Error fetching messages from Redis:', error.message);
    return [];
  }
};

/**
 * Update a message in Redis (for edit functionality)
 * @param {string} roomId - Room ID
 * @param {string} messageId - Message ID to update
 * @param {string} ownerId - Socket ID of message owner (for verification)
 * @param {string} newText - New message text
 * @returns {Promise<{success: boolean, error?: string}>} - Result with optional error
 */
const updateMessage = async (roomId, messageId, ownerId, newText) => {
  if (!isRedisConnected()) {
    return { success: false, error: 'Redis not connected' };
  }

  try {
    const redis = getRedisClient();
    const key = getRoomMessagesKey(roomId);
    
    // Get all messages
    const messagesJson = await redis.lRange(key, 0, -1);
    
    // Find and verify ownership before updating
    let updated = false;
    let ownershipError = false;
    
    const updatedMessages = messagesJson.map(json => {
      try {
        const msg = JSON.parse(json);
        if (msg.id === messageId) {
          // 🔴 SECURITY: Verify message ownership
          if (!msg.id.startsWith(ownerId)) {
            ownershipError = true;
            return json; // Return unchanged
          }
          msg.text = newText;
          msg.isEdited = true;
          msg.editedAt = new Date().toISOString();
          updated = true;
        }
        return JSON.stringify(msg);
      } catch (e) {
        return json;
      }
    });
    
    if (ownershipError) {
      return { success: false, error: 'You can only edit your own messages' };
    }
    
    if (updated) {
      // Delete old list and push updated messages
      await redis.del(key);
      if (updatedMessages.length > 0) {
        await redis.rPush(key, updatedMessages);
        // Refresh TTL on activity
        await redis.expire(key, TTL_SECONDS);
      }
    }
    
    return { success: updated };
  } catch (error) {
    console.error('❌ Error updating message in Redis:', error.message);
    return { success: false, error: 'Failed to update message' };
  }
};

/**
 * Delete a message from Redis
 * @param {string} roomId - Room ID
 * @param {string} messageId - Message ID to delete
 * @param {string} ownerId - Socket ID of message owner (for verification)
 * @returns {Promise<{success: boolean, error?: string}>} - Result with optional error
 */
const deleteMessage = async (roomId, messageId, ownerId) => {
  if (!isRedisConnected()) {
    return { success: false, error: 'Redis not connected' };
  }

  try {
    const redis = getRedisClient();
    const key = getRoomMessagesKey(roomId);
    
    // Get all messages
    const messagesJson = await redis.lRange(key, 0, -1);
    
    // Verify ownership before deleting
    let found = false;
    let ownershipError = false;
    
    const filteredMessages = messagesJson.filter(json => {
      try {
        const msg = JSON.parse(json);
        if (msg.id === messageId) {
          found = true;
          // 🔴 SECURITY: Verify message ownership
          if (!msg.id.startsWith(ownerId)) {
            ownershipError = true;
            return true; // Keep the message (don't delete)
          }
          return false; // Remove this message
        }
        return true;
      } catch (e) {
        return true;
      }
    });
    
    if (ownershipError) {
      return { success: false, error: 'You can only delete your own messages' };
    }
    
    if (!found) {
      return { success: false, error: 'Message not found' };
    }
    
    // Replace list with filtered messages
    await redis.del(key);
    if (filteredMessages.length > 0) {
      await redis.rPush(key, filteredMessages);
      // Refresh TTL on activity
      await redis.expire(key, TTL_SECONDS);
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting message from Redis:', error.message);
    return { success: false, error: 'Failed to delete message' };
  }
};

/**
 * Clear all messages in a room
 * @param {string} roomId - Room ID
 * @returns {Promise<boolean>} - Success status
 */
const clearRoomMessages = async (roomId) => {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const key = getRoomMessagesKey(roomId);
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('❌ Error clearing room messages:', error.message);
    return false;
  }
};

module.exports = {
  saveMessage,
  getRecentMessages,
  updateMessage,
  deleteMessage,
  clearRoomMessages,
  MAX_MESSAGES_PER_ROOM,
  MESSAGES_TO_FETCH
};
