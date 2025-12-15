const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const socketIO = require('socket.io');
const { setupSocketHandlers } = require('./socketHandler');
const { initRedis, closeRedis } = require('./src/config/redis');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const server = http.createServer(app);

// ==================== HTTPS ENFORCEMENT ====================
/**
 * Middleware to enforce HTTPS in production
 * Redirects all HTTP requests to HTTPS
 */
const enforceHTTPS = (req, res, next) => {
  // Only enforce in production environment
  if (process.env.NODE_ENV === 'production') {
    // Check if request is already HTTPS
    // Check multiple headers as different hosting providers use different ones
    const isSecure = 
      req.secure ||                                    // Standard check
      req.headers['x-forwarded-proto'] === 'https' || // Behind proxy (most common)
      req.headers['x-forwarded-ssl'] === 'on' ||      // Some proxies
      req.connection.encrypted;                        // Direct HTTPS
    
    if (!isSecure) {
      // Build HTTPS URL
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      console.log(`🔒 Redirecting HTTP to HTTPS: ${req.url}`);
      return res.redirect(301, httpsUrl); // 301 = Permanent redirect
    }
  }
  
  next(); // Continue to next middleware
};

/**
 * Security headers middleware
 * Adds important security headers to all responses
 */
const securityHeaders = (req, res, next) => {
  // Strict-Transport-Security: Force HTTPS for 1 year
  // Tells browsers to always use HTTPS for this domain
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // X-Content-Type-Options: Prevent MIME type sniffing
  // Stops browsers from guessing file types
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options: Prevent clickjacking
  // Stops your site from being embedded in iframes
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection: Enable browser XSS filter (legacy support)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer-Policy: Control referrer information
  // Limits what information is sent to other sites
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content-Security-Policy: Control what resources can be loaded
  // Prevents XSS and injection attacks
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' wss: https:; " +
    "font-src 'self' data:; " +
    "frame-ancestors 'none';"
  );
  
  next();
};

// ==================== END HTTPS ENFORCEMENT ====================

// Apply HTTPS enforcement first (before other middleware)
app.use(enforceHTTPS);

// Apply security headers
app.use(securityHeaders);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://flashchat-oyd6.onrender.com', 'https://flash-chat-sigma.vercel.app', /\.vercel\.app$/] 
    : '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Basic route for checking server status
app.get('/', (req, res) => {
  res.send({ 
    status: 'online',
    message: 'FlashChat server is running',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint (useful for monitoring services)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Set up socket handlers
setupSocketHandlers(io);

// Initialize Redis and start server
const startServer = async () => {
  // Initialize Redis connection
  await initRedis();
  
  // Set port and start server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`⚡ Server running on port ${PORT}`);
    console.log(`🔌 Socket.IO ready for connections`);
  });
};

startServer();

// Handle server shutdown gracefully
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  
  // Close Redis connection (data persists in Redis with TTL)
  await closeRedis();
  
  io.close();
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Close Redis connection (data persists in Redis with TTL)
  await closeRedis();
  
  io.close();
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});