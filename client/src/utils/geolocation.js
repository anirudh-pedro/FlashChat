/**
 * Get the current position using browser's Geolocation API
 * @returns {Promise} - Resolves with position coordinates or rejects with error
 */
export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        let errorMessage;
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access was denied. Please enable location services to use this feature';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please try again later.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please check your connection and try again.';
            break;
          default:
            errorMessage = 'An unknown error occurred while getting your location.';
        }
        
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

/**
 * Converts precise coordinates to a less precise "area" identifier
 * for privacy and grouping nearby users
 * 
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {string} - Area identifier string
 */
export const getAreaIdentifier = (latitude, longitude) => {
  // Use 0.2 degree grid (~22km cells at equator, ensures devices within 15km join same room)
  // Round to nearest 0.2: divide by 0.2, round, multiply by 0.2
  const gridSize = 0.2;
  const roundedLat = Math.round(latitude / gridSize) * gridSize;
  const roundedLong = Math.round(longitude / gridSize) * gridSize;
  
  // Format to 1 decimal place to avoid floating point precision issues
  const latStr = roundedLat.toFixed(1);
  const longStr = roundedLong.toFixed(1);
  
  // Create location-based room ID with uppercase prefix
  return `LOC_${latStr}_${longStr}`;
};

/**
 * Fetches user's location and returns an area-based room identifier
 * @returns {Promise} - Resolves with room identifier or rejects with error
 */
export const getLocationBasedRoom = async () => {
  try {
    const position = await getCurrentPosition();
    return getAreaIdentifier(position.latitude, position.longitude);
  } catch (error) {
    throw error;
  }
};

export default {
  getCurrentPosition,
  getAreaIdentifier,
  getLocationBasedRoom
};