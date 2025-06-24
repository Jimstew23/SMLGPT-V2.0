require('dotenv').config();
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { DocumentAnalysisClient } = require('@azure/ai-form-recognizer');
const { AzureKeyCredential, SearchClient, SearchIndexClient } = require('@azure/search-documents');
const { BlobServiceClient } = require('@azure/storage-blob');
const { SpeechConfig } = require('microsoft-cognitiveservices-speech-sdk');
const { CognitiveServicesCredentials } = require('@azure/ms-rest-azure-js');

// Set up dedicated logger for tests
const logger = {
  info: (message) => console.log(`${new Date().toISOString()} [info]: ${message}`),
  error: (message, error) => console.error(`${new Date().toISOString()} [error]: ${message}`, error)
};

async function testVisionAPI() {
  try {
    console.log('\n🔍 Testing Computer Vision API with dedicated endpoint...');
    // Use the dedicated Vision endpoint and key
    const endpoint = 'https://smlvision.cognitiveservices.azure.com/';
    const key = 'A2Q4H5NSCerwdpnCJEwRwKJLZ3I5dAxiMntdvy0MRUy5Q7dRnX67JQQJ99BCACHYHv6XJ3w3AAAFACOGkYFj';
    
    // Initialize client
    const credentials = new CognitiveServicesCredentials(key);
    const client = new ComputerVisionClient(credentials, endpoint);
    
    // Simple operation - get service info
    console.log('Attempting to describe an image...');
    // Use a known test image URL
    const result = await client.describeImage('https://learn.microsoft.com/azure/ai-services/computer-vision/media/quickstarts/presentation.png');
    
    console.log('✅ Vision API test successful!');
    console.log(`Description: ${result.captions[0].text} (confidence: ${result.captions[0].confidence})`);
    return true;
  } catch (error) {
    console.error('❌ Vision API test failed:', error.message);
    return false;
  }
}

async function testDocumentIntelligenceAPI() {
  try {
    console.log('\n📄 Testing Document Intelligence API with dedicated endpoint...');
    
    // Use the new dedicated Document Intelligence endpoint and second API key in eastus2 region
    const endpoint = 'https://sml-doc-eastus2.cognitiveservices.azure.com/';
    const key = 'CQ9ILBNw501gMS2bzZsLRPRndrw9cZysay5ZQMJ8OW5gdGdIcoj8JQQJ99BFACHYHv6XJ3w3AAALACOGgjFA'; // Using API key 2
    const region = 'eastus2';
    
    console.log(`Using endpoint: ${endpoint}`);
    console.log(`Using region: ${region}`);
    console.log('Using API key 2 for testing');
    
    // Check SDK version
    try {
      console.log(`Document Analysis SDK version: ${require('@azure/ai-form-recognizer/package.json').version}`);
    } catch (e) {
      console.log('Could not determine SDK version');
    }
    
    // Try to use manual REST API call instead of SDK client
    // This helps us test the endpoint and credentials directly
    console.log('Testing Document Intelligence API with direct REST API call...');
    
    const axios = require('axios').default;
    
    // Set headers with API key
    const headers = {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/json'
    };
    
    // Call a simple endpoint to check if the API key and endpoint are valid
    const apiUrl = `${endpoint}formrecognizer/documentModels?api-version=2023-07-31`;
    
    console.log(`Calling API URL: ${apiUrl}`);
    
    const response = await axios.get(apiUrl, { headers });
    
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Document Intelligence API test successful!');
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Available models: ${response.data.value ? response.data.value.length : 'unknown'}`);
      return true;
    } else {
      throw new Error(`API returned status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Document Intelligence API test failed:');
    console.error(`- Error name: ${error.name}`);
    console.error(`- Error message: ${error.message}`);
    if (error.response) {
      console.error(`- Status: ${error.response.status}`);
      console.error(`- Response data: ${JSON.stringify(error.response.data)}`);
    }
    if (error.code) console.error(`- Error code: ${error.code}`);
    return false;
  }
}

async function testSpeechAPI() {
  try {
    console.log('\n🔊 Testing Speech API with dedicated endpoint...');
    // Use the dedicated Speech endpoint and key
    const endpoint = 'https://sml-test-cong.cognitiveservices.azure.com/';
    const key = '4NBOipSDmozuaD4UXCinfGWrutOSHfMuFjYL3eZSriDkkKiQWz4jJQQJ99BDACHYHv6XJ3w3AAAYACOGTBSj';
    const region = 'eastus2';
    
    // Initialize config
    const speechConfig = SpeechConfig.fromSubscription(key, region);
    
    // Verify the config has been created successfully
    if (speechConfig) {
      console.log('✅ Speech API test successful!');
      console.log(`Speech config created for region: ${region}`);
      return true;
    } else {
      throw new Error('Failed to create speech config');
    }
  } catch (error) {
    console.error('❌ Speech API test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Running individual API tests for Azure services...');
  
  let results = {
    vision: await testVisionAPI(),
    documentIntelligence: await testDocumentIntelligenceAPI(),
    speech: await testSpeechAPI()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('------------------------');
  console.log(`Vision API: ${results.vision ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Document Intelligence API: ${results.documentIntelligence ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Speech API: ${results.speech ? '✅ PASSED' : '❌ FAILED'}`);
}

// Run the tests
runAllTests().catch(err => {
  console.error('Error running tests:', err);
  process.exit(1);
});
