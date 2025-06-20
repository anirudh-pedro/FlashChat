import { getSocket } from '../socket';

/**
 * Function to validate room ID format
 * @param {string} roomId - Room ID to validate
 * @returns {boolean} - True if valid format, false otherwise
 */
export const isValidRoomId = (roomId) => {
  // Check if roomId is a string and has the right format (letters and numbers, 6 characters)
  if (!roomId || typeof roomId !== 'string') return false;
  
  // For location-based rooms that start with LOC_
  if (roomId.startsWith('LOC_')) {
    return roomId.length > 4; // At least some coordinates after the prefix
  }
  
  // For regular rooms, check for 6 alphanumeric characters
  const regex = /^[A-Z0-9]{6}$/;
  return regex.test(roomId);
};

/**
 * Generate a random room ID
 * @param {number} length - Length of the room ID (default: 6)
 * @returns {string} - Random alphanumeric room ID
 */
export const generateRoomId = (length = 6) => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters (O, 0, 1, I)
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
};

/**
 * Check if a room ID is already in use
 * @param {string} roomId - Room ID to check
 * @returns {Promise<boolean>} - Promise resolving to true if active, false if available
 */
export const checkRoomAvailability = async (roomId) => {
  return new Promise((resolve, reject) => {
    const socket = getSocket();
    if (!socket) {
      reject(new Error('Socket connection not available'));
      return;
    }
    
    socket.emit('checkRoomAvailability', roomId, (response) => {
      if (response && response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.isActive);
      }
    });
  });
};

/**
 * Generate a guaranteed unique room ID
 * @param {number} maxAttempts - Maximum number of attempts to find a unique ID (default: 5)
 * @returns {Promise<string>} - Promise resolving to a unique room ID
 */
export const generateUniqueRoomId = async (maxAttempts = 5) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const roomId = generateRoomId();
    try {
      // Verify the ID is valid format first
      if (!isValidRoomId(roomId)) {
        attempts++;
        continue;
      }
      
      // Check if room already exists
      const isActive = await checkRoomAvailability(roomId);
      
      if (!isActive) {
        // Room doesn't exist, we can use this ID
        return roomId;
      }
      
      // Room exists, try again
      attempts++;
    } catch (error) {
      console.error("Error checking room availability:", error);
      // If we can't check, just return a generated ID and hope for the best
      return generateRoomId();
    }
  }
  
  // If we've exhausted our attempts, generate one more ID as a last resort
  return generateRoomId();
};

/**
 * Format room ID for display
 * @param {string} roomId - Room ID
 * @returns {string} - Formatted room name for display
 */
export const formatRoomName = (roomId) => {
  if (!roomId) return 'Unknown Room';
  
  // If it's a location-based room
  if (roomId.startsWith('LOC_')) {
    return 'Nearby Chat';
  }
  
  // For custom rooms, just return the ID
  return roomId;
};

/**
 * Determine if room is location-based
 * @param {string} roomId - Room ID
 * @returns {boolean} - True if location-based
 */
export const isLocationRoom = (roomId) => {
  return roomId && roomId.startsWith('LOC_');
};

/**
 * Extract coordinates from location room ID
 * @param {string} roomId - Location-based room ID
 * @returns {Object|null} - Object with lat and long or null if invalid
 */
export const extractCoordinates = (roomId) => {
  if (!isLocationRoom(roomId)) return null;
  
  const parts = roomId.split('_');
  if (parts.length !== 3) return null;
  
  const lat = parseFloat(parts[1]);
  const long = parseFloat(parts[2]);
  
  if (isNaN(lat) || isNaN(long)) return null;
  
  return { latitude: lat, longitude: long };
};

export default {
  generateRoomId,
  isValidRoomId,
  formatRoomName,
  isLocationRoom,
  extractCoordinates
};