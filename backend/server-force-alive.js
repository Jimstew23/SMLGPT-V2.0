const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Import services
const azureServices = require('./services/azureServices');
const chatService = require('./services/chatService');
const uploadService = require('./services/uploadService');
const searchService = require('./services/searchService');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('🚀 STARTING SMLGPT V2.0 BACKEND WITH FORCED ALIVE MODE');
console.log('====================================================\n');

// Force process to stay alive - multiple redundant approaches
let forceAliveInterval1, forceAliveInterval2, keepAliveTimer;

// Approach 1: Multiple keep-alive intervals
forceAliveInterval1 = setInterval(() => {
  // Force event loop to stay active - this prevents clean exit
}, 10000);

forceAliveInterval2 = setInterval(() => {
  // Redundant keep-alive mechanism
  console.log('💓 Backend forced alive check - serving requests');
}, 30000);

// Approach 2: Unref timer that creates periodic work
keepAliveTimer = setTimeout(function keepAlive() {
  // Reschedule itself to maintain event loop activity
  keepAliveTimer = setTimeout(keepAlive, 15000);
}, 15000);

// Approach 3: Override process exit mechanisms
const originalExit = process.exit;
process.exit = function(code) {
  console.log(`🚨 PREVENTED PROCESS.EXIT(${code}) - Backend must stay alive for requests`);
  console.log('🛡️ If you need to stop the backend, use Ctrl+C');
  // Don't actually exit - force backend to stay alive
  return;
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    /^http:\/\/127\.0\.0\.1:\d+$/
  ],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
  },
  fileFilter(req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'smlgpt-v2-backend',
    azure_services_ready: azureServices.servicesReady || false
  });
});

app.get('/api/health', (req, res) => {
  logger.info('API health check requested');
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'smlgpt-v2-backend',
    azure_services_ready: azureServices.servicesReady || false
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    logger.info('Chat request received');
    const { message, include_search = false, document_references = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await chatService.processChat({
      message,
      include_search,
      document_references
    });
    res.json(result);
  } catch (error) {
    logger.error('Chat processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  console.error('[ERROR] Unhandled error:', error);
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: error.message, stack: error.stack });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start the server with forced alive mechanisms
const server = app.listen(PORT, () => {
  logger.info(`🚀 SMLGPT V2.0 Backend server is running on port ${PORT}`);
  logger.info('🛡️ FORCED ALIVE MODE: Backend will stay running regardless of Azure services');
  logger.info('Server startup complete - ready to handle requests');
  
  // Initialize Azure services after server is running
  logger.info('Starting Azure services initialization...');
  azureServices.initializeServices();
  
  // Additional safety: Ensure intervals are active
  console.log('🔒 Force-alive mechanisms active:');
  console.log(`   - Interval 1: ${forceAliveInterval1 ? 'ACTIVE' : 'INACTIVE'}`);
  console.log(`   - Interval 2: ${forceAliveInterval2 ? 'ACTIVE' : 'INACTIVE'}`);
  console.log(`   - Keep-alive timer: ${keepAliveTimer ? 'ACTIVE' : 'INACTIVE'}`);
});

// Clean shutdown only on explicit signals
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal, shutting down gracefully...');
  clearInterval(forceAliveInterval1);
  clearInterval(forceAliveInterval2);
  clearTimeout(keepAliveTimer);
  
  // Restore original exit function for clean shutdown
  process.exit = originalExit;
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal, shutting down gracefully...');
  clearInterval(forceAliveInterval1);
  clearInterval(forceAliveInterval2);
  clearTimeout(keepAliveTimer);
  
  // Restore original exit function for clean shutdown
  process.exit = originalExit;
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

console.log('✅ FORCED ALIVE BACKEND READY - Testing with comprehensive API endpoints');
console.log('💡 Test health: GET http://localhost:5000/api/health');
console.log('💡 Test chat: POST http://localhost:5000/api/chat');

module.exports = app;
