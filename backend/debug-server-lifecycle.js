const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Test minimal server without Azure services
const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/api/health', (req, res) => {
  console.log('Health endpoint called');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server and add debug logging
console.log('🚀 Starting minimal server test...');

const server = app.listen(PORT, () => {
  console.log(`✅ Minimal server running on port ${PORT}`);
  console.log('Server should stay running to handle requests...');
});

// Add event listeners to debug process lifecycle
process.on('exit', (code) => {
  console.log(`❌ Process exiting with code: ${code}`);
});

process.on('beforeExit', (code) => {
  console.log(`⚠️ Process about to exit with code: ${code}`);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT (Ctrl+C)');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('📊 Process started, waiting for requests...');
console.log('💡 Test with: GET http://localhost:5000/api/health');

// Keep process alive indicator
let aliveCounter = 0;
const keepAliveInterval = setInterval(() => {
  aliveCounter++;
  console.log(`💓 Process alive check #${aliveCounter} - Server should be running`);
  
  if (aliveCounter > 10) {
    console.log('✅ Process lifecycle test PASSED - server stays running');
    clearInterval(keepAliveInterval);
  }
}, 2000);
