const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { SMGPTTestScenarios } = require('./flowTracer');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected clients and recent updates
const clients = new Set();
let recentUpdates = [];

// Broadcast updates to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  
  // Store for HTTP polling fallback
  recentUpdates.push(data);
  if (recentUpdates.length > 50) {
    recentUpdates = recentUpdates.slice(-50); // Keep last 50 updates
  }
  
  console.log(`Broadcasting: ${data.type} - ${data.step || data.method || 'update'}`);
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending to client:', error);
        clients.delete(client);
      }
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Monitor client connected. Total clients: ${clients.size}`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    step: 'Monitor connected',
    status: 'success',
    timestamp: 0
  }));
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Monitor client disconnected. Total clients: ${clients.size}`);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Parse JSON bodies
app.use(express.json());

// Serve static files (including the dashboard)
app.use(express.static(__dirname));

// Enhanced tester with monitoring
class MonitoredSMLGPTTester extends SMGPTTestScenarios {
  constructor(baseURL = 'http://localhost:5000') {
    super(baseURL);
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    // Override the tracer log method to broadcast updates
    const originalLog = this.tracer.log.bind(this.tracer);
    this.tracer.log = (step, status, details = {}) => {
      // Call original log
      originalLog(step, status, details);
      
      // Safely extract message with proper null checking
      let detailsMessage = '';
      if (details) {
        if (typeof details === 'string') {
          detailsMessage = details;
        } else if (typeof details === 'object') {
          detailsMessage = details.message || JSON.stringify(details);
        } else {
          detailsMessage = String(details);
        }
      }
      
      // Broadcast to monitoring dashboard
      broadcast({
        type: 'step',
        step,
        status,
        details: detailsMessage,
        timestamp: Date.now() - this.tracer.startTime,
        flowStage: this.determineFlowStage(step, status)
      });
    };
    
    // Override API trace method
    const originalTrace = this.tracer.traceAPICall.bind(this.tracer);
    this.tracer.traceAPICall = async (...args) => {
      const startTime = Date.now();
      const [method, url, data] = args;
      
      broadcast({
        type: 'api_call',
        method,
        url,
        status: 'pending',
        flowStage: this.determineAPIFlowStage(url),
        timestamp: 0
      });
      
      try {
        const result = await originalTrace(...args);
        
        broadcast({
          type: 'api_call',
          method,
          url,
          status: result.status,
          duration: Date.now() - startTime,
          flowStage: 'response',
          data: result.data ? JSON.stringify(result.data).substring(0, 200) : ''
        });
        
        return result;
      } catch (error) {
        broadcast({
          type: 'error',
          step: `${method} ${url}`,
          details: {
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace available'
          },
          flowStage: 'backend',
          timestamp: Date.now()
        });
        throw error;
      }
    };
  }
  
  determineFlowStage(step, status) {
    const stepLower = step.toLowerCase();
    if (stepLower.includes('health') || stepLower.includes('backend')) return 'backend';
    if (stepLower.includes('upload') || stepLower.includes('file')) return 'backend';
    if (stepLower.includes('chat') || stepLower.includes('azure')) return 'azure';
    if (stepLower.includes('response') || stepLower.includes('completed')) return 'response';
    return 'frontend';
  }
  
  determineAPIFlowStage(url) {
    if (url.includes('/health')) return 'backend';
    if (url.includes('/upload')) return 'backend';
    if (url.includes('/chat')) return 'azure';
    return 'backend';
  }
}

// Test endpoints
app.post('/test/:type', async (req, res) => {
  const testType = req.params.type;
  console.log(`\n🧪 Starting ${testType} test...`);
  
  try {
    const tester = new MonitoredSMLGPTTester();
    let result;
    
    // Send initial broadcast
    broadcast({
      type: 'step',
      step: `Starting ${testType} test`,
      status: 'info',
      timestamp: 0,
      flowStage: 'frontend'
    });
    
    switch (testType) {
      case 'health':
        result = await tester.testHealthCheck();
        break;
        
      case 'upload':
        const testImagePath = await tester.createTestImage();
        result = await tester.testImageUpload(testImagePath);
        break;
        
      case 'chat':
        result = await tester.testChatWithImage('Test safety analysis message', []);
        break;
        
      case 'full':
        result = await tester.runFullScenario();
        break;
        
      default:
        throw new Error(`Unknown test type: ${testType}`);
    }
    
    // Send completion broadcast
    broadcast({
      type: 'step',
      step: `${testType} test completed`,
      status: result ? 'success' : 'error',
      timestamp: Date.now(),
      flowStage: 'response'
    });
    
    res.json({ 
      status: 'Test completed', 
      success: !!result,
      testType,
      report: {
        steps: tester.tracer.steps.length,
        errors: tester.tracer.errors.length,
        apiCalls: tester.tracer.apiCalls.length
      }
    });
    
  } catch (error) {
    console.error(`Test ${testType} failed:`, error);
    
    broadcast({
      type: 'error',
      step: `${testType} test failed`,
      details: {
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace available'
      },
      flowStage: 'backend',
      timestamp: Date.now()
    });
    
    res.status(500).json({ 
      error: error.message, 
      testType,
      stack: error.stack 
    });
  }
});

// Status endpoint for polling fallback
app.get('/status', (req, res) => {
  res.json({
    connected: clients.size,
    recentUpdates: recentUpdates.slice(-10), // Last 10 updates
    timestamp: new Date().toISOString(),
    server: 'SMLGPT Test Monitor v1.0'
  });
});

// Health check for the test server itself
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    clients: clients.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Dashboard route
app.get('/', (req, res) => {
  res.redirect('/monitor-dashboard.html');
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'SMLGPT Test Monitor API',
    version: '1.0.0',
    endpoints: [
      {
        path: '/test/:type',
        method: 'POST',
        description: 'Run test scenarios',
        parameters: {
          type: 'health | upload | chat | full'
        }
      },
      {
        path: '/status',
        method: 'GET',
        description: 'Get server status and recent updates'
      },
      {
        path: '/health',
        method: 'GET',
        description: 'Health check for test server'
      },
      {
        path: '/',
        method: 'GET',
        description: 'Redirect to monitoring dashboard'
      }
    ],
    websocket: {
      url: 'ws://localhost:8082',
      description: 'Real-time updates for test monitoring'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
const PORT = process.env.TEST_PORT || 8082;

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 SMLGPT Test Monitor Server Started');
  console.log('='.repeat(60));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`📊 Dashboard URL: http://localhost:${PORT}/monitor-dashboard.html`);
  console.log(`🔌 WebSocket URL: ws://localhost:${PORT}`);
  console.log(`📋 API Docs: http://localhost:${PORT}/api/docs`);
  console.log('='.repeat(60));
  console.log('\n🚀 Ready to monitor SMLGPT tests!');
  console.log('💡 Open the dashboard URL in your browser to start monitoring\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test monitor server...');
  
  // Close WebSocket connections
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });
  
  server.close(() => {
    console.log('✅ Test monitor server stopped');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  broadcast({
    type: 'error',
    step: 'Server exception',
    details: {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace available'
    }
  });
});

module.exports = { server, broadcast };
