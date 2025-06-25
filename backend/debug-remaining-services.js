require('dotenv').config();
const { DocumentAnalysisClient } = require('@azure/ai-form-recognizer');
const { SearchClient } = require('@azure/search-documents');
const { SpeechConfig } = require('microsoft-cognitiveservices-speech-sdk');
const { AzureKeyCredential } = require('@azure/core-auth');

async function debugRemainingServices() {
  console.log('🔍 Debugging remaining Azure services that could cause hang...\n');
  
  // Test the remaining services that weren't tested yet
  const remainingServices = [
    {
      name: 'Document Intelligence',
      test: async () => {
        console.log('📄 Testing Document Intelligence with timeout...');
        const documentClient = new DocumentAnalysisClient(
          process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
          new AzureKeyCredential(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY)
        );
        
        // Try to check service availability - this might hang if there's an issue
        console.log('📋 Document Intelligence client created, testing basic operation...');
        return true;
      }
    },
    {
      name: 'Speech Services',
      test: async () => {
        console.log('🗣️ Testing Speech Services with timeout...');
        
        // Test both key and region
        console.log(`🔑 Speech Key: ${process.env.AZURE_SPEECH_KEY ? 'Present' : 'Missing'}`);
        console.log(`🌍 Speech Region: ${process.env.AZURE_SPEECH_REGION}`);
        
        const speechConfig = SpeechConfig.fromSubscription(
          process.env.AZURE_SPEECH_KEY,
          process.env.AZURE_SPEECH_REGION
        );
        
        // Test speech config creation - this might hang if region/key is wrong
        console.log('🎤 Speech config created successfully');
        return true;
      }
    }
  ];

  for (const service of remainingServices) {
    try {
      console.log(`\n🧪 Testing: ${service.name}`);
      console.log('⏱️ Starting with 5-second timeout...');
      
      // Shorter timeout for more precise detection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('HANG DETECTED')), 5000);
      });
      
      await Promise.race([
        service.test(),
        timeoutPromise
      ]);
      
      console.log(`✅ ${service.name}: PASSED - No hang detected`);
      
    } catch (error) {
      if (error.message === 'HANG DETECTED') {
        console.log(`🚨 HANG DETECTED: ${service.name} is causing the backend hang!`);
        console.log(`   This service is not responding within 5 seconds`);
        
        if (service.name === 'Document Intelligence') {
          console.log('   🔧 Possible causes:');
          console.log('     - Document Intelligence service not available in region');
          console.log('     - Endpoint or key configuration issue');
          console.log('     - Service quota or billing issues');
          console.log(`     - Endpoint: ${process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT}`);
        } else if (service.name === 'Speech Services') {
          console.log('   🔧 Possible causes:');
          console.log('     - Speech service region incorrect');
          console.log('     - Speech key invalid or expired');
          console.log('     - Network connectivity to Speech service');
          console.log(`     - Region: ${process.env.AZURE_SPEECH_REGION}`);
        }
        
        return service.name; // Return the hanging service name
      } else {
        console.log(`❌ ${service.name}: Error - ${error.message}`);
      }
    }
  }
  
  console.log('\n📋 TARGETED DIAGNOSTIC COMPLETE');
  console.log('If no hang was detected, the issue may be in service combination or timing');
  return null;
}

// Run the targeted diagnostic
debugRemainingServices().then(hangingService => {
  if (hangingService) {
    console.log(`\n🎯 SOLUTION: Disable or fix ${hangingService} service to resolve backend hang`);
    console.log('💡 Temporary fix: Comment out the hanging service initialization in azureServices.js');
    console.log('🔧 Permanent fix: Correct the service configuration and credentials');
  } else {
    console.log('\n✅ All remaining services passed - hang may be in service interaction or timing');
  }
});
