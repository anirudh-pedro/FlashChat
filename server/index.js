const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const socketIO = require('socket.io');
const { setupSocketHandlers } = require('./socketHandler');
const { initRedis, closeRedis } = require('./src/config/redis');

dotenv.config();

const app = express();
const server = http.createServer(app);

const enforceHTTPS = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const isSecure = 
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      req.headers['x-forwarded-ssl'] === 'on' ||
      req.connection.encrypted;
    
    if (!isSecure) {
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      console.log(`🔒 Redirecting HTTP to HTTPS: ${req.url}`);
      return res.redirect(301, httpsUrl);
    }
  }
  
  next();
};

const securityHeaders = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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

app.use(enforceHTTPS);
app.use(securityHeaders);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://flashchat-oyd6.onrender.com', 'https://flash-chat-sigma.vercel.app', /\.vercel\.app$/] 
    : '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send({ 
    status: 'online',
    message: 'FlashChat server is running',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

setupSocketHandlers(io);

const startServer = async () => {
  await initRedis();
  
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`⚡ Server running on port ${PORT}`);
    console.log(`🔌 Socket.IO ready for connections`);
  });
};

startServer();

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await closeRedis();
  io.close();
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await closeRedis();
  io.close();
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});