require('dotenv').config();
const { BlobServiceClient } = require('@azure/storage-blob');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { CognitiveServicesCredentials } = require('@azure/ms-rest-azure-js');
const { DocumentAnalysisClient } = require('@azure/ai-form-recognizer');
const { SearchClient, SearchIndexClient } = require('@azure/search-documents');
const { SpeechConfig } = require('microsoft-cognitiveservices-speech-sdk');
const { AzureKeyCredential } = require('@azure/core-auth');

async function debugAzureServicesHang() {
  console.log('🔍 Starting Azure Services Hang Diagnostic...\n');
  
  // Test each service with timeout to isolate hanging service
  const serviceTests = [
    {
      name: 'Blob Storage',
      test: async () => {
        console.log('📦 Testing Blob Storage initialization...');
        const blobServiceClient = BlobServiceClient.fromConnectionString(
          process.env.AZURE_STORAGE_CONNECTION_STRING
        );
        // Test basic connectivity
        const serviceProperties = await blobServiceClient.getProperties();
        console.log('✅ Blob Storage: Connected successfully');
        return true;
      }
    },
    {
      name: 'Computer Vision',
      test: async () => {
        console.log('👁️ Testing Computer Vision initialization...');
        const computerVisionKey = new CognitiveServicesCredentials(process.env.AZURE_COMPUTER_VISION_KEY);
        const visionClient = new ComputerVisionClient(computerVisionKey, process.env.AZURE_COMPUTER_VISION_ENDPOINT);
        // Test basic connectivity - just create client (no API call)
        console.log('✅ Computer Vision: Client created successfully');
        return true;
      }
    },
    {
      name: 'Document Intelligence',
      test: async () => {
        console.log('📄 Testing Document Intelligence initialization...');
        const documentClient = new DocumentAnalysisClient(
          process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
          new AzureKeyCredential(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY)
        );
        // Test basic connectivity - just create client (no API call)
        console.log('✅ Document Intelligence: Client created successfully');
        return true;
      }
    },
    {
      name: 'Azure Search',
      test: async () => {
        console.log('🔍 Testing Azure Search initialization...');
        const searchClient = new SearchClient(
          process.env.AZURE_SEARCH_ENDPOINT,
          'smlgpt-v2-index',
          new AzureKeyCredential(process.env.AZURE_SEARCH_ADMIN_KEY)
        );
        
        // Test actual connectivity
        const result = await searchClient.search('*', { top: 1 });
        console.log('✅ Azure Search: Connected and functional');
        return true;
      }
    },
    {
      name: 'Speech Services',
      test: async () => {
        console.log('🗣️ Testing Speech Services initialization...');
        const speechConfig = SpeechConfig.fromSubscription(
          process.env.AZURE_SPEECH_KEY,
          process.env.AZURE_SPEECH_REGION
        );
        // Test basic configuration
        console.log('✅ Speech Services: Config created successfully');
        return true;
      }
    }
  ];

  // Test each service with individual timeout
  for (const serviceTest of serviceTests) {
    try {
      console.log(`\n🧪 Testing: ${serviceTest.name}`);
      console.log('⏱️ Starting with 10-second timeout...');
      
      // Create a promise that times out after 10 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Service test timed out')), 10000);
      });
      
      // Race between the service test and timeout
      await Promise.race([
        serviceTest.test(),
        timeoutPromise
      ]);
      
      console.log(`🎉 ${serviceTest.name}: PASSED`);
      
    } catch (error) {
      console.log(`❌ ${serviceTest.name}: FAILED`);
      console.log(`   Error: ${error.message}`);
      
      if (error.message === 'Service test timed out') {
        console.log(`🚨 HANG DETECTED: ${serviceTest.name} is causing the initialization hang!`);
        console.log(`   This service is not responding within 10 seconds`);
        
        // Provide specific guidance for each service
        if (serviceTest.name === 'Blob Storage') {
          console.log('   🔧 Check: AZURE_STORAGE_CONNECTION_STRING');
          console.log('   🔧 Verify: Azure Storage account is accessible');
        } else if (serviceTest.name === 'Computer Vision') {
          console.log('   🔧 Check: AZURE_COMPUTER_VISION_KEY and AZURE_COMPUTER_VISION_ENDPOINT');
          console.log('   🔧 Verify: Computer Vision service is enabled');
        } else if (serviceTest.name === 'Document Intelligence') {
          console.log('   🔧 Check: Document Intelligence service configuration');
          console.log('   🔧 Verify: Same endpoint as Computer Vision');
        } else if (serviceTest.name === 'Speech Services') {
          console.log('   🔧 Check: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION');
          console.log('   🔧 Verify: Speech service is enabled in correct region');
        }
        
        break; // Stop testing after finding the hanging service
      }
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📋 DIAGNOSTIC SUMMARY');
  console.log('====================');
  console.log('✅ This diagnostic isolates which Azure service is causing the backend hang');
  console.log('🔧 Check the failed service configuration and credentials');
  console.log('🚀 Once fixed, the backend should start successfully');
}

// Check environment variables first
console.log('🔍 Checking environment variables...');
const requiredEnvVars = [
  'AZURE_STORAGE_CONNECTION_STRING',
  'AZURE_COMPUTER_VISION_KEY', 
  'AZURE_COMPUTER_VISION_ENDPOINT',
  'AZURE_DOCUMENT_INTELLIGENCE_KEY',
  'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',
  'AZURE_SEARCH_ENDPOINT',
  'AZURE_SEARCH_ADMIN_KEY',
  'AZURE_SPEECH_KEY',
  'AZURE_SPEECH_REGION'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.log('❌ Missing environment variables:', missingVars.join(', '));
  console.log('🔧 Add these variables to your .env file before running again');
  process.exit(1);
} else {
  console.log('✅ All required environment variables present\n');
  debugAzureServicesHang();
}
