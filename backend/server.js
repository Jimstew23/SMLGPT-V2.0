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
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    /^http:\/\/127\.0\.0\.1:\d+$/  // Allow any port on 127.0.0.1 for browser previews
  ],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 
                         'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDF, and DOCX files are allowed.'), false);
    }
  },
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes

// Chat endpoint - Main GPT-4.1 chat with RAG
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversation_history, include_context, document_references } = req.body;
    
    // DEBUG LOGGING
    logger.info('=== CHAT REQUEST RECEIVED ===', {
      message: message.substring(0, 50),
      hasHistory: !!conversation_history,
      includeContext: include_context,
      documentReferences: document_references,
      documentCount: document_references ? document_references.length : 0
    });
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Your existing chat processing...
    const response = await chatService.processChat({
      message,
      conversation_id: req.session?.conversation_id,
      include_search: include_context,
      document_references: document_references || []
    });
    
    res.json(response);
  } catch (error) {
    console.error('[ERROR] /api/chat threw:', error);
    logger.error('Chat endpoint error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    logger.info(`File upload request: ${req.file.originalname} (${req.file.size} bytes)`);
    
    const result = await uploadService.processFileUpload(req.file);
    
    res.json(result);
  } catch (error) {
    console.error('[ERROR] /api/upload threw:', error);
    logger.error('Upload endpoint error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Speech-to-text endpoint
app.post('/api/speech/recognize', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    // Detect audio format based on mimetype or filename extension
    let format = 'wav'; // Default format
    
    if (req.file.mimetype) {
      if (req.file.mimetype.includes('mp3')) {
        format = 'mp3';
      } else if (req.file.mimetype.includes('wav') || req.file.mimetype.includes('audio/wav')) {
        format = 'wav';
      }
    } else if (req.file.originalname) {
      if (req.file.originalname.toLowerCase().endsWith('.mp3')) {
        format = 'mp3';
      } else if (req.file.originalname.toLowerCase().endsWith('.wav')) {
        format = 'wav';
      }
    }
    
    logger.info(`Speech recognition request with ${format} format`);
    
    // Pass detected format to the speech-to-text service
    const result = await azureServices.speechToText(req.file.buffer, 'en-US', format);
    
    res.json({ text: result });
  } catch (error) {
    console.error('[ERROR] /api/speech/recognize threw:', error);
    logger.error('Speech recognition error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Text-to-speech endpoint
app.post('/api/speech/synthesize', async (req, res) => {
  try {
    const { text, voice = 'en-US-AriaNeural' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const audioBuffer = await azureServices.textToSpeech(text, voice);
    
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length,
    });
    
    res.send(audioBuffer);
  } catch (error) {
    console.error('[ERROR] /api/speech/synthesize threw:', error);
    logger.error('Speech synthesis error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query, top = 10, include_embeddings = false } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await searchService.searchDocuments({
      query,
      top,
      include_embeddings
    });
    
    res.json(results);
  } catch (error) {
    console.error('[ERROR] /api/search threw:', error);
    logger.error('Search endpoint error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Enhanced Safety Analysis endpoint
app.post('/api/safety/analyze-enhanced', upload.single('image'), async (req, res) => {
  try {
    logger.info('Enhanced safety analysis request received');
    
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    
    const { filename, buffer } = req.file;
    const { additional_context = '' } = req.body;
    
    logger.info('Processing enhanced safety analysis', {
      filename,
      fileSize: buffer.length,
      hasContext: !!additional_context
    });
    
    // Use enhanced safety analysis
    const analysis = await chatService.analyzeImageWithEnhancedSafety(buffer, filename);
    
    // Add additional context to the response if provided
    if (additional_context) {
      analysis.additional_context = additional_context;
    }
    
    logger.info('Enhanced safety analysis completed', {
      filename,
      riskLevel: analysis.safety_analysis.risk_level,
      confidenceLevel: analysis.safety_analysis.confidence_level,
      stopWorkRequired: analysis.safety_analysis.stop_work_required,
      hazardsCount: analysis.safety_analysis.hazards.length
    });
    
    res.json(analysis);
    
  } catch (error) {
    console.error('[ERROR] /api/safety/analyze-enhanced threw:', error);
    logger.error('Enhanced safety analysis error:', error);
    res.status(500).json({ 
      error: error.message, 
      stack: error.stack,
      type: 'enhanced_safety_analysis_error'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint for Azure services
app.get('/api/test/azure-services', async (req, res) => {
  const { getAzureMultiService } = require('./services/azureMultiService');
  const results = {
    timestamp: new Date().toISOString(),
    services: {}
  };
  
  try {
    // Test Multi-Service initialization
    const azureMultiService = getAzureMultiService();
    results.services.multiService = 'Initialized';
    
    // Test Blob Storage
    try {
      const containerClient = azureMultiService.blobServiceClient
        .getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME);
      const exists = await containerClient.exists();
      results.services.blobStorage = exists ? 'Connected' : 'Container not found';
    } catch (error) {
      results.services.blobStorage = `Failed: ${error.message}`;
    }
    
    // Show configured endpoints
    results.endpoints = {
      computerVision: process.env.AZURE_COMPUTER_VISION_ENDPOINT,
      documentIntelligence: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
      openAI: process.env.AZURE_OPENAI_ENDPOINT,
      speech: process.env.AZURE_SPEECH_ENDPOINT
    };
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query, top = 10, include_embeddings = false } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await searchService.searchDocuments({
      query,
      top,
      include_embeddings
    });
    
    res.json(results);
  } catch (error) {
    console.error('[ERROR] /api/search threw:', error);
    logger.error('Search endpoint error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Upload Pipeline Test Endpoint
app.get('/api/test/upload-pipeline', async (req, res) => {
  const { getAzureMultiService } = require('./services/azureMultiService');
  const results = { timestamp: new Date().toISOString(), tests: {} };
  
  try {
    const azureMultiService = getAzureMultiService();
    
    // Test 1: Blob Storage
    try {
      const testBuffer = Buffer.from('test upload pipeline');
      const filename = `test_${Date.now()}.txt`;
      const blobResult = await azureMultiService.uploadToBlob(filename, testBuffer, 'text/plain');
      results.tests.blobStorage = { status: 'OK', url: blobResult.url };
    } catch (error) {
      results.tests.blobStorage = { status: 'FAILED', error: error.message };
    }
    
    // Test 2: Computer Vision (with a simple test image)
    try {
      // Create a 1x1 pixel PNG buffer
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
      await azureMultiService.analyzeImage(pngBuffer);
      results.tests.computerVision = { status: 'OK' };
    } catch (error) {
      results.tests.computerVision = { status: 'FAILED', error: error.message };
    }
    
    // Test 3: Document Intelligence
    try {
      const testPdf = Buffer.from('test document content');
      await azureMultiService.analyzeDocument(testPdf, 'application/pdf');
      results.tests.documentIntelligence = { status: 'OK' };
    } catch (error) {
      results.tests.documentIntelligence = { status: 'FAILED', error: error.message };
    }
    
    // Test 4: Azure Search (if enabled)
    try {
      const searchService = require('./services/searchService');
      await searchService.getSearchStatistics();
      results.tests.azureSearch = { status: 'OK' };
    } catch (error) {
      results.tests.azureSearch = { status: 'FAILED', error: error.message };
    }
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Document Store Debug Endpoint
app.get('/api/debug/documents', (req, res) => {
  try {
    const allDocs = documentStore.getAllDocuments();
    res.json({
      count: allDocs.length,
      documents: allDocs.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        type: doc.contentType,
        hasBlobUrl: !!doc.blobUrl,
        hasContent: !!doc.content,
        uploadedAt: doc.uploadedAt
      }))
    });
  } catch (error) {
    logger.error('Document store debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cache statistics endpoint
app.get('/api/cache/stats', (req, res) => {
  const cacheService = require('./services/cacheService');
  const stats = cacheService.getStats();
  res.json(stats);
});

// Clear cache endpoint (for testing)
app.post('/api/cache/clear', (req, res) => {
  const cacheService = require('./services/cacheService');
  cacheService.clearAll();
  res.json({ message: 'Cache cleared successfully' });
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

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`SMLGPT V2.0 Backend server is running on port ${PORT}`);
  logger.info('Server startup complete - ready to handle requests');
  
  // Initialize Azure services after server is running
  logger.info('Starting Azure services initialization...');
  azureServices.initializeServices();
  
  // Ensure server stays alive by maintaining active handles
  const keepAliveInterval = setInterval(() => {
    // Silent keep-alive to prevent event loop from becoming empty
    // This ensures the server process stays running even after Azure services complete
  }, 30000); // Check every 30 seconds
  
  // Clean shutdown handling
  process.on('SIGINT', () => {
    logger.info('Received SIGINT signal, shutting down gracefully...');
    clearInterval(keepAliveInterval);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal, shutting down gracefully...');
    clearInterval(keepAliveInterval);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
});

module.exports = app;
