/**
 * Redis Client Configuration
 * Uses Upstash Redis for serverless-friendly Redis hosting
 */

const { createClient } = require('redis');

// Redis client instance
let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis connection
 * @returns {Promise<RedisClient>} - Connected Redis client
 */
const initRedis = async () => {
  // Return existing client if already connected
  if (redisClient && isConnected) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn(' REDIS_URL not found in environment variables');
    console.warn(' Redis features will be disabled');
    return null;
  }

  try {
    // Create Redis client with Upstash URL
    redisClient = createClient({
      url: redisUrl,
      socket: {
        // Reconnection settings
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error(' Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff: 100ms, 200ms, 400ms... up to 3 seconds
          const delay = Math.min(retries * 100, 3000);
          console.log(` Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
        connectTimeout: 10000, // 10 seconds timeout
      }
    });

    // Handle connection events
    redisClient.on('connect', () => {
      console.log(' Redis: Connecting...');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      console.log(' Redis: Connected successfully');
    });

    redisClient.on('error', (err) => {
      console.error(' Redis Error:', err.message);
      isConnected = false;
    });

    redisClient.on('end', () => {
      console.log(' Redis: Connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      console.log(' Redis: Reconnecting...');
    });

    // Connect to Redis
    await redisClient.connect();

    return redisClient;
  } catch (error) {
    console.error(' Redis: Failed to connect:', error.message);
    isConnected = false;
    return null;
  }
};

/**
 * Get the Redis client instance
 * @returns {RedisClient|null} - Redis client or null if not connected
 */
const getRedisClient = () => {
  if (!redisClient || !isConnected) {
    return null;
  }
  return redisClient;
};

/**
 * Check if Redis is connected
 * @returns {boolean} - Connection status
 */
const isRedisConnected = () => {
  return isConnected && redisClient !== null;
};

/**
 * Gracefully close Redis connection
 */
const closeRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log(' Redis: Disconnected gracefully');
    } catch (error) {
      console.error(' Redis: Error during disconnect:', error.message);
      // Force close if quit fails
      redisClient.disconnect();
    }
    redisClient = null;
    isConnected = false;
  }
};

module.exports = {
  initRedis,
  getRedisClient,
  isRedisConnected,
  closeRedis
};
