const express = require('express');
const cors = require('cors');
require('dotenv').config();

// COMPREHENSIVE PROCESS EXIT DEBUGGING
console.log('🕵️ COMPREHENSIVE PROCESS EXIT DEBUGGING');
console.log('===========================================\n');

// Track all possible exit scenarios
let exitCaught = false;

// 1. Track unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log('💥 UNHANDLED PROMISE REJECTION DETECTED!');
  console.log('Promise:', promise);
  console.log('Reason:', reason);
  console.log('Stack:', reason?.stack);
  exitCaught = true;
});

// 2. Track uncaught exceptions
process.on('uncaughtException', (error) => {
  console.log('💥 UNCAUGHT EXCEPTION DETECTED!');
  console.log('Error:', error.message);
  console.log('Stack:', error.stack);
  exitCaught = true;
});

// 3. Track all exit scenarios
process.on('exit', (code) => {
  console.log(`\n🚨 PROCESS EXITING with code: ${code}`);
  if (!exitCaught) {
    console.log('🎯 CLEAN EXIT - No errors detected, but process is still terminating');
    console.log('💡 This indicates the event loop became empty or process.exit() was called');
  }
});

process.on('beforeExit', (code) => {
  console.log(`\n⚠️ BEFORE EXIT with code: ${code}`);
  console.log('📊 Active handles:', process._getActiveHandles().length);
  console.log('📊 Active requests:', process._getActiveRequests().length);
});

// 4. Track signals
process.on('SIGINT', () => {
  console.log('🛑 SIGINT received');
  exitCaught = true;
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received');
  exitCaught = true;
});

// 5. Override process.exit to catch manual exits
const originalExit = process.exit;
process.exit = function(code) {
  console.log(`\n🚨 MANUAL PROCESS.EXIT(${code}) CALLED!`);
  console.log('Stack trace:');
  console.trace();
  exitCaught = true;
  return originalExit.call(this, code);
};

// Create minimal express server
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  console.log('✅ Health endpoint called - server is responsive');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
console.log('🚀 Starting server with comprehensive exit tracking...');
const server = app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);
  
  // Now import and test Azure services with full error tracking
  console.log('\n📋 Testing Azure Services Import and Initialization...');
  
  try {
    // Import Azure services (this might cause issues)
    console.log('  📥 Importing Azure services...');
    const azureServices = require('./services/azureServices');
    console.log('  ✅ Azure services imported successfully');
    
    // Initialize Azure services (this is the suspected exit trigger)
    console.log('  🔧 Calling azureServices.initializeServices()...');
    azureServices.initializeServices();
    console.log('  ✅ Azure services initialization called');
    
    // Wait for async initialization to complete
    console.log('  ⏳ Waiting for async initialization to complete...');
    if (azureServices.initializationPromise) {
      await azureServices.initializationPromise;
      console.log('  ✅ Azure services async initialization completed');
    }
    
    console.log('\n🎉 ALL TESTS PASSED - Server should stay running now');
    
  } catch (error) {
    console.log('\n💥 ERROR during Azure services testing:');
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    exitCaught = true;
  }
});

// Keep alive monitoring
let heartbeat = 0;
const heartbeatInterval = setInterval(() => {
  heartbeat++;
  console.log(`💓 Heartbeat #${heartbeat} - Server alive and should be serving requests`);
  
  if (heartbeat > 20) {
    console.log('\n✅ SUCCESS: Server has remained stable for extended period');
    console.log('🎯 Backend is now ready for production use');
    clearInterval(heartbeatInterval);
  }
}, 3000);

console.log('\n🔍 Process exit debugging active - waiting for issues...');
console.log('💡 Test health endpoint: GET http://localhost:5000/api/health');
