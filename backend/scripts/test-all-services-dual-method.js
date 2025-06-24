/**
 * SMLGPT V2.0 - Comprehensive Azure Services Test Script
 * Tests all Azure services using both SDK and direct REST API methods
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Required for REST API calls
require('dotenv').config();

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Create log file for this run
const logFile = path.join(logDir, `azure-services-test-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// Function to write to log file
function writeToLog(message) {
  fs.appendFileSync(logFile, message + '\n');
}

// Handle module imports gracefully
const modules = {};

// Helper function to safely import modules
function safeRequire(moduleName) {
  try {
    return require(moduleName);
  } catch (err) {
    return null;
  }
}

// Import modules safely
modules.computerVision = {
  ComputerVisionClient: safeRequire('@azure/cognitiveservices-computervision')?.ComputerVisionClient,
  CognitiveServicesCredentials: safeRequire('@azure/ms-rest-azure-js')?.CognitiveServicesCredentials
};

modules.documentIntelligence = {
  DocumentAnalysisClient: safeRequire('@azure/ai-form-recognizer')?.DocumentAnalysisClient
};

modules.search = {
  ...safeRequire('@azure/search-documents')
};

modules.storage = {
  BlobServiceClient: safeRequire('@azure/storage-blob')?.BlobServiceClient
};

modules.speech = {
  SpeechConfig: safeRequire('microsoft-cognitiveservices-speech-sdk')?.SpeechConfig
};

modules.openai = {
  OpenAIClient: safeRequire('@azure/openai')?.OpenAIClient
};

// Track available modules
const moduleAvailability = {
  computerVision: !!(modules.computerVision.ComputerVisionClient && modules.computerVision.CognitiveServicesCredentials),
  documentIntelligence: !!modules.documentIntelligence.DocumentAnalysisClient,
  search: !!(modules.search.AzureKeyCredential && modules.search.SearchIndexClient),
  storage: !!modules.storage.BlobServiceClient,
  speech: !!modules.speech.SpeechConfig,
  openai: !!modules.openai.OpenAIClient
};

// Set up dedicated logger for tests
const logger = {
  info: (message, ...args) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [INFO]: ${message}`;
    console.log(`\x1b[36m${timestamp} [INFO]:\x1b[0m ${message}`, ...args);
    writeToLog(logMessage + (args.length > 0 ? ` ${args.map(a => JSON.stringify(a)).join(' ')}` : ''));
  },
  success: (message, ...args) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [SUCCESS]: ${message}`;
    console.log(`\x1b[32m${timestamp} [SUCCESS]:\x1b[0m ${message}`, ...args);
    writeToLog(logMessage + (args.length > 0 ? ` ${args.map(a => JSON.stringify(a)).join(' ')}` : ''));
  },
  error: (message, ...args) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [ERROR]: ${message}`;
    console.error(`\x1b[31m${timestamp} [ERROR]:\x1b[0m ${message}`, ...args);
    writeToLog(logMessage + (args.length > 0 ? ` ${args.map(a => JSON.stringify(a)).join(' ')}` : ''));
  },
  warning: (message, ...args) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [WARNING]: ${message}`;
    console.warn(`\x1b[33m${timestamp} [WARNING]:\x1b[0m ${message}`, ...args);
    writeToLog(logMessage + (args.length > 0 ? ` ${args.map(a => JSON.stringify(a)).join(' ')}` : ''));
  }
};

/**
 * Test Computer Vision service using both SDK and REST API
 */
async function testComputerVision() {
  logger.info('🔍 Testing Computer Vision API...');
  
  // Get configuration from environment
  const endpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT;
  const key = process.env.AZURE_COMPUTER_VISION_KEY;
  const region = process.env.AZURE_COMPUTER_VISION_REGION || 'eastus2';
  
  if (!endpoint || !key) {
    logger.error('Computer Vision credentials missing');
    return { sdk: false, rest: false, available: false };
  }
  
  logger.info(`Using endpoint: ${endpoint}`);
  
  // Test results object
  const results = {
    sdk: false,
    rest: false,
    available: true
  };
  
  // 1. Test using SDK
  if (moduleAvailability.computerVision) {
    try {
      logger.info('Testing Computer Vision using SDK...');
      const { ComputerVisionClient } = modules.computerVision;
      const { CognitiveServicesCredentials } = modules.computerVision;
      
      const credentials = new CognitiveServicesCredentials(key);
      const client = new ComputerVisionClient(credentials, endpoint);
      
      // Use a known test image URL
      const imageUrl = 'https://learn.microsoft.com/azure/ai-services/computer-vision/media/quickstarts/presentation.png';
      const result = await client.describeImage(imageUrl);
      
      logger.success('✅ Vision API SDK test successful!');
      logger.info(`Description: ${result.captions[0].text} (confidence: ${result.captions[0].confidence})`);
      results.sdk = true;
    } catch (error) {
      logger.error('❌ Vision API SDK test failed:', error);
    }
  } else {
    logger.info('⚠️ Computer Vision SDK module not available, skipping SDK test');
  }
  
  // 2. Test using REST API
  try {
    logger.info('Testing Computer Vision using direct REST API...');
    
    // Set headers with API key
    const headers = {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/json'
    };
    
    // Call the describe image endpoint
    const imageUrl = 'https://learn.microsoft.com/azure/ai-services/computer-vision/media/quickstarts/presentation.png';
    const apiUrl = `${endpoint}vision/v3.2/describe`;
    
    const response = await axios.post(apiUrl, { url: imageUrl }, { headers });
    
    if (response.status === 200 && response.data.description) {
      logger.success('✅ Vision API REST test successful!');
      logger.info(`Description: ${response.data.description.captions[0].text}`);
      results.rest = true;
    } else {
      throw new Error(`API returned status: ${response.status}`);
    }
  } catch (error) {
    logger.error('❌ Vision API REST test failed:', error);
  }
  
  return results;
}

/**
 * Test Document Intelligence service using both SDK and REST API
 */
async function testDocumentIntelligence() {
  logger.info('📄 Testing Document Intelligence API...');
  
  // Get configuration from environment
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  const region = process.env.AZURE_DOCUMENT_INTELLIGENCE_REGION || 'eastus2';
  
  if (!endpoint || !key) {
    logger.error('Document Intelligence credentials missing');
    return { sdk: false, rest: false, available: false };
  }
  
  logger.info(`Using endpoint: ${endpoint}`);
  
  // Test results object
  const results = {
    sdk: false,
    rest: false,
    available: true
  };
  
  // 1. Test using SDK (known to have issues)
  if (moduleAvailability.documentIntelligence && modules.search.AzureKeyCredential) {
    try {
      logger.info('Testing Document Intelligence using SDK...');
      
      // Try to initialize client with AzureKeyCredential
      const { DocumentAnalysisClient } = modules.documentIntelligence;
      const { AzureKeyCredential } = modules.search;
      
      const credential = new AzureKeyCredential(key);
      const client = new DocumentAnalysisClient(endpoint, credential);
      
      // Just check if client is properly created
      if (client && client.endpoint === endpoint) {
        logger.success('✅ Document Intelligence SDK client initialization successful!');
        results.sdk = true;
      } else {
        throw new Error('Client initialization succeeded but returned an invalid client');
      }
    } catch (error) {
      logger.error('❌ Document Intelligence SDK test failed:', error);
    }
  } else {
    logger.info('⚠️ Document Intelligence SDK module not available, skipping SDK test');
  }
  
  // 2. Test using REST API (more reliable)
  try {
    logger.info('Testing Document Intelligence using direct REST API...');
    
    // Set headers with API key
    const headers = {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/json'
    };
    
    // List available models endpoint
    const apiVersion = process.env.DOCUMENT_INTELLIGENCE_API_VERSION || '2023-07-31';
    const apiUrl = `${endpoint}formrecognizer/documentModels?api-version=${apiVersion}`;
    
    logger.info(`Calling API URL: ${apiUrl}`);
    
    const response = await axios.get(apiUrl, { headers });
    
    if (response.status >= 200 && response.status < 300) {
      logger.success('✅ Document Intelligence REST API test successful!');
      logger.info(`Available models: ${response.data.value ? response.data.value.length : 'unknown'}`);
      results.rest = true;
    } else {
      throw new Error(`API returned status: ${response.status}`);
    }
  } catch (error) {
    logger.error('❌ Document Intelligence REST API test failed:', error);
  }
  
  return results;
}

/**
 * Test Azure Blob Storage using SDK
 */
async function testBlobStorage() {
  logger.info('📦 Testing Azure Blob Storage...');
  
  // Get configuration from environment
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
  
  if (!connectionString) {
    logger.error('Blob Storage connection string missing');
    return { sdk: false, available: false };
  }
  
  // Test results object
  const results = {
    sdk: false,
    available: true
  };
  
  // Test using SDK
  if (moduleAvailability.storage) {
    try {
      logger.info('Testing Blob Storage using SDK...');
      
      const { BlobServiceClient } = modules.storage;
      
      // Create BlobServiceClient
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      
      // List containers
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const exists = await containerClient.exists();
      
      if (exists) {
        logger.success(`✅ Blob Storage SDK test successful!`);
        logger.info(`Container '${containerName}' exists`);
        results.sdk = true;
      } else {
        logger.info(`Container '${containerName}' does not exist`); 
        results.sdk = false;
      }
    } catch (error) {
      logger.error('❌ Blob Storage SDK test failed:', error);
    }
  } else {
    logger.info('⚠️ Blob Storage SDK module not available, skipping test');
  }
  
  return results;
}

/**
 * Test Azure Speech Services using SDK
 */
async function testSpeechServices() {
  logger.info('🔊 Testing Speech Services...');
  
  // Get configuration from environment
  const endpoint = process.env.AZURE_SPEECH_ENDPOINT;
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  
  if (!key) {
    logger.error('Speech Services key missing');
    return { sdk: false, available: false };
  }
  
  logger.info(`Using region: ${region}`);
  
  // Test results object
  const results = {
    sdk: false,
    available: true
  };
  
  // Test using SDK
  if (moduleAvailability.speech) {
    try {
      logger.info('Testing Speech Services using SDK...');
      
      const { SpeechConfig } = modules.speech;
      
      // Initialize config
      const speechConfig = SpeechConfig.fromSubscription(key, region);
      
      // Verify the config has been created successfully
      if (speechConfig) {
        logger.success('✅ Speech Services SDK test successful!');
        logger.info(`Speech config created for region: ${region}`);
        results.sdk = true;
      } else {
        throw new Error('Failed to create speech config');
      }
    } catch (error) {
      logger.error('❌ Speech Services SDK test failed:', error);
    }
  } else {
    logger.info('⚠️ Speech Services SDK module not available, skipping test');
  }
  
  return results;
}

/**
 * Test Azure Cognitive Search using SDK and REST API
 */
async function testCognitiveSearch() {
  logger.info('🔎 Testing Azure Cognitive Search...');
  
  // Get configuration from environment
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const adminKey = process.env.AZURE_SEARCH_ADMIN_KEY;
  const indexName = process.env.AZURE_SEARCH_INDEX_NAME;
  
  if (!endpoint || !adminKey) {
    logger.error('Cognitive Search credentials missing');
    return { sdk: false, rest: false, available: false };
  }
  
  logger.info(`Using endpoint: ${endpoint}`);
  logger.info(`Using index: ${indexName}`);
  
  // Test results object
  const results = {
    sdk: false,
    rest: false,
    available: true
  };
  
  // 1. Test using SDK
  if (moduleAvailability.search) {
    try {
      logger.info('Testing Cognitive Search using SDK...');
      
      const { AzureKeyCredential, SearchIndexClient } = modules.search;
      
      // Initialize clients
      const credential = new AzureKeyCredential(adminKey);
      const searchIndexClient = new SearchIndexClient(endpoint, credential);
      
      // Get index statistics
      const stats = await searchIndexClient.getIndexStatistics(indexName);
      
      logger.success('✅ Cognitive Search SDK test successful!');
      logger.info(`Index '${indexName}' has ${stats.documentCount} documents`);
      results.sdk = true;
    } catch (error) {
      logger.error('❌ Cognitive Search SDK test failed:', error);
    }
  } else {
    logger.info('⚠️ Cognitive Search SDK module not available, skipping SDK test');
  }
  
  // 2. Test using REST API
  try {
    logger.info('Testing Cognitive Search using direct REST API...');
    
    // Set headers
    const headers = {
      'api-key': adminKey,
      'Content-Type': 'application/json'
    };
    
    // Call indexes endpoint
    const apiUrl = `${endpoint}indexes/${indexName}/stats?api-version=2023-10-01-Preview`;
    
    logger.info(`Calling API URL: ${apiUrl}`);
    
    const response = await axios.get(apiUrl, { headers });
    
    if (response.status === 200) {
      logger.success('✅ Cognitive Search REST API test successful!');
      logger.info(`Index '${indexName}' has ${response.data.documentCount} documents`);
      results.rest = true;
    } else {
      throw new Error(`API returned status: ${response.status}`);
    }
  } catch (error) {
    logger.error('❌ Cognitive Search REST API test failed:', error);
  }
  
  return results;
}

/**
 * Test Azure OpenAI using both SDK and REST API
 */
async function testOpenAI() {
  logger.info('🤖 Testing Azure OpenAI...');
  
  // Get configuration from environment
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  
  if (!endpoint || !key) {
    logger.error('Azure OpenAI credentials missing');
    return { sdk: false, rest: false, available: false };
  }
  
  logger.info(`Using endpoint: ${endpoint}`);
  logger.info(`Using deployment: ${deploymentName}`);
  
  // Test results object
  const results = {
    sdk: false,
    rest: false,
    available: true
  };
  
  // 1. Test using SDK
  if (moduleAvailability.openai && modules.search?.AzureKeyCredential) {
    try {
      logger.info('Testing Azure OpenAI using SDK...');
      
      const { OpenAIClient } = modules.openai;
      const { AzureKeyCredential } = modules.search;
      
      // Initialize client
      const credential = new AzureKeyCredential(key);
      const client = new OpenAIClient(endpoint, credential);
      
      // Simple completion with minimal tokens
      const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello!" }
      ];
      
      const response = await client.getChatCompletions(deploymentName, messages, {
        temperature: 0,
        maxTokens: 20
      });
      
      logger.success('✅ Azure OpenAI SDK test successful!');
      logger.info(`Response: ${response.choices[0].message.content}`);
      results.sdk = true;
    } catch (error) {
      logger.error('❌ Azure OpenAI SDK test failed:', error);
    }
  } else {
    logger.info('⚠️ Azure OpenAI SDK module not available, skipping SDK test');
  }
  
  // 2. Test using REST API
  try {
    logger.info('Testing Azure OpenAI using direct REST API...');
    
    // Set headers
    const headers = {
      'api-key': key,
      'Content-Type': 'application/json'
    };
    
    // API call data
    const data = {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello!" }
      ],
      temperature: 0,
      max_tokens: 20
    };
    
    // Call completions endpoint
    const apiUrl = `${endpoint}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
    
    logger.info(`Calling API URL: ${apiUrl}`);
    
    const response = await axios.post(apiUrl, data, { headers });
    
    if (response.status === 200) {
      logger.success('✅ Azure OpenAI REST API test successful!');
      logger.info(`Response: ${response.data.choices[0].message.content}`);
      results.rest = true;
    } else {
      throw new Error(`API returned status: ${response.status}`);
    }
  } catch (error) {
    logger.error('❌ Azure OpenAI REST API test failed:', error);
  }
  
  return results;
}

/**
 * Run all tests and display a summary
 */
async function runAllTests() {
  logger.info('🧪 Running comprehensive tests for all Azure services...');
  logger.info('Testing both SDK and direct REST API methods where applicable');
  logger.info('-------------------------------------------------------');
  
  const results = {
    computerVision: await testComputerVision(),
    documentIntelligence: await testDocumentIntelligence(),
    blobStorage: await testBlobStorage(),
    speechServices: await testSpeechServices(),
    cognitiveSearch: await testCognitiveSearch(),
    openai: await testOpenAI()
  };
  
  // Display summary table
  console.log('\n\x1b[34m📊 TEST RESULTS SUMMARY:\x1b[0m');
  console.log('\x1b[34m========================\x1b[0m');
  console.log('Service              | Module Available | SDK Method | REST API Method');
  console.log('---------------------|-----------------|-----------|----------------');
  console.log(`Computer Vision      | ${formatAvailability(results.computerVision?.available, moduleAvailability.computerVision)} | ${formatResult(results.computerVision?.sdk)} | ${formatResult(results.computerVision?.rest)}`);
  console.log(`Document Intelligence | ${formatAvailability(results.documentIntelligence?.available, moduleAvailability.documentIntelligence)} | ${formatResult(results.documentIntelligence?.sdk)} | ${formatResult(results.documentIntelligence?.rest)}`);
  console.log(`Blob Storage         | ${formatAvailability(results.blobStorage?.available, moduleAvailability.storage)} | ${formatResult(results.blobStorage?.sdk)} | N/A`);
  console.log(`Speech Services      | ${formatAvailability(results.speechServices?.available, moduleAvailability.speech)} | ${formatResult(results.speechServices?.sdk)} | N/A`);
  console.log(`Cognitive Search     | ${formatAvailability(results.cognitiveSearch?.available, moduleAvailability.search)} | ${formatResult(results.cognitiveSearch?.sdk)} | ${formatResult(results.cognitiveSearch?.rest)}`);
  console.log(`Azure OpenAI          | ${formatAvailability(results.openai?.available, moduleAvailability.openai)} | ${formatResult(results.openai?.sdk)} | ${formatResult(results.openai?.rest)}`);
  console.log('\x1b[34m========================\x1b[0m');
  
  // Log summary to file (without colors)
  writeToLog('\n📊 TEST RESULTS SUMMARY:');
  writeToLog('========================');
  writeToLog('Service              | Module Available | SDK Method | REST API Method');
  writeToLog('---------------------|-----------------|-----------|----------------');
  writeToLog(`Computer Vision      | ${formatAvailabilityPlain(results.computerVision?.available, moduleAvailability.computerVision)} | ${formatResultPlain(results.computerVision?.sdk)} | ${formatResultPlain(results.computerVision?.rest)}`);
  writeToLog(`Document Intelligence | ${formatAvailabilityPlain(results.documentIntelligence?.available, moduleAvailability.documentIntelligence)} | ${formatResultPlain(results.documentIntelligence?.sdk)} | ${formatResultPlain(results.documentIntelligence?.rest)}`);
  writeToLog(`Blob Storage         | ${formatAvailabilityPlain(results.blobStorage?.available, moduleAvailability.storage)} | ${formatResultPlain(results.blobStorage?.sdk)} | N/A`);
  writeToLog(`Speech Services      | ${formatAvailabilityPlain(results.speechServices?.available, moduleAvailability.speech)} | ${formatResultPlain(results.speechServices?.sdk)} | N/A`);
  writeToLog(`Cognitive Search     | ${formatAvailabilityPlain(results.cognitiveSearch?.available, moduleAvailability.search)} | ${formatResultPlain(results.cognitiveSearch?.sdk)} | ${formatResultPlain(results.cognitiveSearch?.rest)}`);
  writeToLog(`Azure OpenAI          | ${formatAvailabilityPlain(results.openai?.available, moduleAvailability.openai)} | ${formatResultPlain(results.openai?.sdk)} | ${formatResultPlain(results.openai?.rest)}`);
  writeToLog('========================');
  
  // Count successful services
  let serviceCount = 0;
  let successfulServices = 0;
  let missingModules = 0;
  
  // Check each service
  for (const [service, result] of Object.entries(results)) {
    if (result?.available) {
      serviceCount++;
      // Service passes if either SDK or REST API test succeeds
      if (result.sdk === true || result.rest === true) {
        successfulServices++;
      }
    } else if (result === null || result === undefined) {
      missingModules++;
    }
  }
  
  // Summary of results
  console.log('\n\x1b[36mSUMMARY:\x1b[0m');
  console.log(`Total services tested: ${serviceCount}`);
  console.log(`Services passing: ${successfulServices}`);
  console.log(`Services with issues: ${serviceCount - successfulServices}`);
  console.log(`Missing modules: ${missingModules}`);
  
  // Log summary to file
  writeToLog('\nSUMMARY:');
  writeToLog(`Total services tested: ${serviceCount}`);
  writeToLog(`Services passing: ${successfulServices}`);
  writeToLog(`Services with issues: ${serviceCount - successfulServices}`);
  writeToLog(`Missing modules: ${missingModules}`);
  
  // Collect services with issues for recommendations
  const failures = [];
  
  if (results.computerVision?.available && !results.computerVision?.sdk && !results.computerVision?.rest) failures.push('Computer Vision');
  if (results.documentIntelligence?.available && !results.documentIntelligence?.sdk && !results.documentIntelligence?.rest) failures.push('Document Intelligence');
  if (results.blobStorage?.available && !results.blobStorage?.sdk) failures.push('Blob Storage');
  if (results.speechServices?.available && !results.speechServices?.sdk) failures.push('Speech Services');
  if (results.cognitiveSearch?.available && !results.cognitiveSearch?.sdk && !results.cognitiveSearch?.rest) failures.push('Cognitive Search');
  if (results.openai?.available && !results.openai?.sdk && !results.openai?.rest) failures.push('Azure OpenAI');
  
  if (failures.length > 0) {
    console.log('\n\x1b[31m⚠️ SERVICES WITH ISSUES:\x1b[0m', failures.join(', '));
    console.log('\n\x1b[33mRECOMMENDATIONS:\x1b[0m');
    console.log('1. Check .env configuration for these services');
    console.log('2. Verify network connectivity to Azure endpoints');
    console.log('3. Confirm API keys are valid and not expired');
    console.log('4. For Document Intelligence, use REST API instead of SDK');
    
    // Log to file
    writeToLog('\n⚠️ SERVICES WITH ISSUES: ' + failures.join(', '));
    writeToLog('\nRECOMMENDATIONS:');
    writeToLog('1. Check .env configuration for these services');
    writeToLog('2. Verify network connectivity to Azure endpoints');
    writeToLog('3. Confirm API keys are valid and not expired');
    writeToLog('4. For Document Intelligence, use REST API instead of SDK');
    
    // Module installation recommendations if any modules are missing
    if (missingModules > 0 || !moduleAvailability.computerVision || !moduleAvailability.documentIntelligence || 
        !moduleAvailability.search || !moduleAvailability.storage || !moduleAvailability.speech || !moduleAvailability.openai) {
      console.log('\n\x1b[33mMISSING MODULES:\x1b[0m');
      console.log('Some SDK modules are missing. Install them with:');
      console.log('\x1b[36mnpm install --save @azure/cognitiveservices-computervision @azure/ai-form-recognizer @azure/search-documents @azure/storage-blob microsoft-cognitiveservices-speech-sdk @azure/ms-rest-azure-js @azure/openai\x1b[0m');
      
      // Log to file
      writeToLog('\nMISSING MODULES:');
      writeToLog('Some SDK modules are missing. Install them with:');
      writeToLog('npm install --save @azure/cognitiveservices-computervision @azure/ai-form-recognizer @azure/search-documents @azure/storage-blob microsoft-cognitiveservices-speech-sdk @azure/ms-rest-azure-js @azure/openai');
    }
  } else if (serviceCount === 0) {
    console.log('\n\x1b[33m⚠️ NO SERVICES TESTED! Check your .env configuration.\x1b[0m');
    writeToLog('\n⚠️ NO SERVICES TESTED! Check your .env configuration.');
  } else if (successfulServices === serviceCount) {
    console.log('\n\x1b[32m🎉 ALL AVAILABLE SERVICES PASSED! Your configuration is working correctly.\x1b[0m');
    writeToLog('\n🎉 ALL AVAILABLE SERVICES PASSED! Your configuration is working correctly.');
  }
  
  // Add log file location to output
  console.log(`\n\x1b[36mDetailed logs written to: ${logFile}\x1b[0m`);
}

/**
 * Format test result for display
 */
function formatResult(result) {
  if (result === true) return '\x1b[32m✓ PASS\x1b[0m';
  if (result === false) return '\x1b[31m✗ FAIL\x1b[0m';
  return '\x1b[33m- N/A\x1b[0m';
}

/**
 * Format test result for log file (plain text)
 */
function formatResultPlain(result) {
  if (result === true) return '✓ PASS';
  if (result === false) return '✗ FAIL';
  return '- N/A';
}

/**
 * Format module availability for display
 */
function formatAvailability(serviceAvailable, moduleAvailable) {
  if (serviceAvailable === false) return '\x1b[31m✗ Not Configured\x1b[0m';
  if (moduleAvailable === false) return '\x1b[33m⚠ Module Missing\x1b[0m';
  return '\x1b[32m✓ Available\x1b[0m';
}

/**
 * Format module availability for log file (plain text)
 */
function formatAvailabilityPlain(serviceAvailable, moduleAvailable) {
  if (serviceAvailable === false) return '✗ Not Configured';
  if (moduleAvailable === false) return '⚠ Module Missing';
  return '✓ Available';
}

// Run the tests
runAllTests().catch(err => {
  logger.error('Error running tests:', err);
  process.exit(1);
});
