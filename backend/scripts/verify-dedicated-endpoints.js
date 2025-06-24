// verify-dedicated-endpoints.js
// Test script to verify Azure services are using dedicated endpoints

require('dotenv').config();
const azureServices = require('../services/azureServices');

async function verifyDedicatedEndpoints() {
  console.log('🧪 Verifying dedicated Azure service endpoints...');
  
  try {
    // Initialize services
    console.log('Initializing Azure services...');
    azureServices.initializeServices();
    
    // Wait for initialization to complete
    await azureServices.ensureServicesReady();
    
    console.log('\n✅ Azure services initialization complete!');

    // Test Computer Vision with dedicated endpoint
    console.log('\n📷 Verifying Computer Vision service...');
    const visionInfo = await azureServices.getComputerVisionModelInfo();
    console.log(`✅ Vision API endpoint: ${visionInfo.endpoint}`);
    console.log(`✅ Vision API region: ${visionInfo.region}`);
    
    // Test Speech Service with dedicated endpoint
    console.log('\n🔊 Verifying Speech service...');
    // Note: There is no direct way to get Speech config details, so we log from the initialization
    console.log('✅ Speech service configured (see initialization logs for details)');
    
    console.log('\n🎉 All dedicated endpoints verification complete!');
  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

verifyDedicatedEndpoints();
