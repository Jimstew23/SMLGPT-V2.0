const axios = require('axios');

async function validateFramework() {
  console.log('🔧 Validating SMLGPT Testing Framework Fixes...\n');
  
  try {
    // Test server health
    console.log('1. Testing server health...');
    const healthResponse = await axios.get('http://localhost:8082/health');
    console.log('✅ Server health:', healthResponse.data);
    
    // Test status endpoint
    console.log('\n2. Testing status endpoint...');
    const statusResponse = await axios.get('http://localhost:8082/status');
    console.log('✅ Server status:', statusResponse.data);
    
    // Test a simple health check
    console.log('\n3. Testing health check scenario...');
    const testResponse = await axios.post('http://localhost:8082/test/health');
    console.log('✅ Health test response:', testResponse.data.status);
    
    console.log('\n🎉 ALL VALIDATION TESTS PASSED!');
    console.log('\n📍 The framework is ready to use:');
    console.log('   💻 Dashboard: http://localhost:8082/monitor-dashboard.html');
    console.log('   🔗 WebSocket: ws://localhost:8082');
    console.log('   📊 Status: http://localhost:8082/status');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Open the dashboard in your browser');
    console.log('   2. Click "Run Full Scenario" to test your SMLGPT system');
    console.log('   3. Watch real-time network tracing to debug issues');
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

validateFramework();
