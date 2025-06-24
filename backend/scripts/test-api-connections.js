require('dotenv').config();
const logger = require('../utils/logger');
const azureServices = require('../services/azureServices');

/**
 * Test script to verify all Azure service connections
 */
async function testApiConnections() {
  console.log('🔑 Testing API keys and endpoints connectivity...\n');
  
  try {
    // Initialize Azure services
    console.log('⏳ Initializing Azure services...');
    // Call the correct initialization method
    azureServices.initializeServices();
    // Wait for initialization to complete
    await azureServices.initializationPromise;
    console.log('✅ Azure services initialized successfully!\n');
    
    // Test Blob Storage
    console.log('🧪 Testing Azure Blob Storage connection...');
    const blobContainers = await azureServices.listBlobContainers();
    console.log(`✅ Blob Storage connected! Found ${blobContainers.length} containers.`);
    console.log(`   Container name: ${process.env.AZURE_STORAGE_CONTAINER_NAME}`);
    
    // Test Computer Vision
    console.log('\n🧪 Testing Azure Computer Vision connection...');
    const visionInfo = await azureServices.getComputerVisionModelInfo();
    console.log(`✅ Computer Vision connected! Using endpoint: ${process.env.AZURE_COMPUTER_VISION_ENDPOINT}`);
    
    // Test Document Intelligence 
    console.log('\n🧪 Testing Azure Document Intelligence connection...');
    const documentInfo = await azureServices.getDocumentIntelligenceInfo();
    console.log(`✅ Document Intelligence connected! Using endpoint: ${process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT}`);
    
    // Test Cognitive Search
    console.log('\n🧪 Testing Azure Cognitive Search connection...');
    const searchInfo = await azureServices.testSearchConnection();
    console.log(`✅ Cognitive Search connected! Using endpoint: ${process.env.AZURE_SEARCH_ENDPOINT}`);
    console.log(`   Index name: ${process.env.AZURE_SEARCH_INDEX_NAME}`);
    
    // Test OpenAI connection
    console.log('\n🧪 Testing Azure OpenAI connection...');
    const openaiInfo = await azureServices.testOpenAIConnection();
    console.log(`✅ Azure OpenAI connected! Using endpoint: ${process.env.AZURE_OPENAI_ENDPOINT}`);
    console.log(`   Model: ${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`);
    
    // Test Speech Services
    console.log('\n🧪 Testing Azure Speech Services connection...');
    const speechInfo = await azureServices.testSpeechConnection();
    console.log(`✅ Speech Services connected! Using region: ${process.env.AZURE_SPEECH_REGION}`);
    
    console.log('\n🎉 All services connected successfully!');
    
  } catch (error) {
    console.error('❌ Error testing connections:', error);
    console.log('\n⚠️ API Connection Test Failed ⚠️');
    console.log('Error Details:', error.message);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('\n🔍 DNS Resolution Error Detected:');
      console.log('   This typically means one of your endpoints cannot be reached.');
      console.log('   Check the endpoint URL format and validate the service is available.');
    }
    
    process.exit(1);
  }
}

// Run the test
testApiConnections();
