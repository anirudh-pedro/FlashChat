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
        // Favor faster network-based location, but allow moderate timeout
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 60000
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
export const getAreaIdentifier = (latitude, longitude, accuracyMeters = null) => {
  // Adaptive grid based on accuracy: keep close devices together even when accuracy is coarse
  // accuracyMeters can be undefined; if poor (>20km) we widen the grid to avoid split rooms
  let gridSize = 0.2; // ~22km across, ~11km radius
  if (accuracyMeters && accuracyMeters > 20000) {
    gridSize = 1.0; // very coarse accuracy, bucket to ~111km to keep users together
  } else if (accuracyMeters && accuracyMeters > 10000) {
    gridSize = 0.5; // ~55km across, ~27km radius
  }

  const roundedLat = Math.round(latitude / gridSize) * gridSize;
  const roundedLong = Math.round(longitude / gridSize) * gridSize;

  // Choose decimal places based on grid size for stable strings
  const decimals = gridSize >= 1 ? 0 : gridSize >= 0.5 ? 1 : 2;
  const latStr = roundedLat.toFixed(decimals);
  const longStr = roundedLong.toFixed(decimals);
  
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
    return getAreaIdentifier(position.latitude, position.longitude, position.accuracy);
  } catch (error) {
    throw error;
  }
};

export default {
  getCurrentPosition,
  getAreaIdentifier,
  getLocationBasedRoom
};