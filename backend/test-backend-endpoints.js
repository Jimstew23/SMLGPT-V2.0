const axios = require('axios');

async function testBackendEndpoints() {
  console.log('🧪 Testing Backend Endpoints...\n');
  
  const baseURL = 'http://localhost:5000/api';
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`, { timeout: 5000 });
    console.log('✅ Health Check Response:', healthResponse.status, healthResponse.statusText);
    console.log('   Data:', JSON.stringify(healthResponse.data, null, 2));
    
    // Test 2: Chat Endpoint (basic test)
    console.log('\n2️⃣ Testing Chat Endpoint...');
    const chatPayload = {
      message: 'Hello, this is a test message',
      include_search: false,
      document_references: []
    };
    
    const chatResponse = await axios.post(`${baseURL}/chat`, chatPayload, { 
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Chat Response:', chatResponse.status, chatResponse.statusText);
    console.log('   Response length:', chatResponse.data?.response?.length || 0, 'characters');
    console.log('   Model used:', chatResponse.data?.model || 'Unknown');
    console.log('   Processing time:', chatResponse.data?.processingTime || 'Unknown');
    
    console.log('\n🎉 All Backend Tests PASSED! Backend is fully functional.');
    return true;
    
  } catch (error) {
    console.log('\n❌ Backend Test Failed:');
    console.log('Error:', error.message);
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Backend server is not running on port 5000');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 Backend request timed out - may still be initializing');
    }
    
    return false;
  }
}

// Run the test
testBackendEndpoints().then(success => {
  if (success) {
    console.log('\n✅ BACKEND VERIFICATION COMPLETE: All systems operational');
  } else {
    console.log('\n❌ BACKEND VERIFICATION FAILED: Issues detected');
  }
});
