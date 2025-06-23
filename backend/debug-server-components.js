const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

console.log('🔍 SYSTEMATIC SERVER COMPONENT DIAGNOSTIC');
console.log('Building up from working minimal server to isolate shutdown cause...\n');

// Test 1: Basic Express + Middleware (like working minimal server)
console.log('📋 Test 1: Basic Express + Middleware');
const app = express();
const PORT = process.env.PORT || 5000;

// Add middleware one by one and monitor for exits
console.log('  ✅ Express app created');

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
console.log('  ✅ Helmet middleware added');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);
console.log('  ✅ Rate limiter added');

app.use(cors({
  origin: [
    'http://localhost:3000',
    /^http:\/\/127\.0\.0\.1:\d+$/
  ],
  credentials: true,
}));
console.log('  ✅ CORS added');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
console.log('  ✅ Body parsing middleware added');

// Test 2: Import services (but don't use them yet)
console.log('\n📋 Test 2: Importing Services (without using)');
try {
  const logger = require('./utils/logger');
  console.log('  ✅ Logger imported');
  
  // Import services without calling them
  const azureServices = require('./services/azureServices');
  console.log('  ✅ Azure services imported (not initialized)');
  
  const chatService = require('./services/chatService');
  console.log('  ✅ Chat service imported');
  
  const uploadService = require('./services/uploadService');
  console.log('  ✅ Upload service imported');
  
  const searchService = require('./services/searchService');
  console.log('  ✅ Search service imported');
  
} catch (error) {
  console.log('  ❌ ERROR importing services:', error.message);
  console.log('  🎯 SHUTDOWN CAUSE: Service import failure');
  process.exit(1);
}

// Test 3: Basic routes
console.log('\n📋 Test 3: Adding Basic Routes');
app.get('/api/health', (req, res) => {
  console.log('Health endpoint called');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
console.log('  ✅ Health route added');

// Test 4: Start server
console.log('\n📋 Test 4: Starting Server');
const server = app.listen(PORT, () => {
  console.log(`  ✅ Server listening on port ${PORT}`);
  console.log('  ✅ Server startup sequence complete');
  
  // Test 5: Azure services initialization (the suspected culprit)
  console.log('\n📋 Test 5: Azure Services Initialization');
  try {
    const azureServices = require('./services/azureServices');
    console.log('  📞 Calling azureServices.initializeServices()...');
    azureServices.initializeServices();
    console.log('  ✅ Azure services initialization called successfully');
  } catch (error) {
    console.log('  ❌ ERROR in Azure services initialization:', error.message);
    console.log('  🎯 SHUTDOWN CAUSE: Azure services initialization failure');
  }
});

// Process lifecycle monitoring
process.on('exit', (code) => {
  console.log(`\n❌ PROCESS EXITING with code: ${code}`);
  console.log('🎯 If this happens unexpectedly, the cause is above this line');
});

process.on('beforeExit', (code) => {
  console.log(`\n⚠️ PROCESS ABOUT TO EXIT with code: ${code}`);
});

console.log('\n💓 Monitoring process lifecycle...');
console.log('🔍 Watch for unexpected exit messages to identify shutdown cause');

// Keep alive monitor
let keepAliveCounter = 0;
const keepAliveInterval = setInterval(() => {
  keepAliveCounter++;
  console.log(`💓 Keep-alive #${keepAliveCounter} - Process should stay running`);
  
  if (keepAliveCounter > 15) {
    console.log('\n✅ DIAGNOSTIC COMPLETE: Server stays running normally');
    console.log('🎯 No shutdown cause detected - server is stable');
    clearInterval(keepAliveInterval);
  }
}, 2000);
