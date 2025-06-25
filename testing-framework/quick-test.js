const { SMGPTTestScenarios } = require('./flowTracer');

async function quickTest() {
  console.log('🔧 Testing the fixed framework without WebSocket...\n');
  
  try {
    const tester = new SMGPTTestScenarios();
    
    console.log('✅ Framework initialized successfully');
    console.log('✅ Tracer object created without errors');
    
    // Test the fixed log method
    console.log('\n🧪 Testing fixed log method...');
    tester.tracer.log('Test Step', 'SUCCESS', undefined);
    tester.tracer.log('Test Step 2', 'INFO', null);
    tester.tracer.log('Test Step 3', 'INFO', { message: 'Test message' });
    tester.tracer.log('Test Step 4', 'INFO', 'Simple string');
    
    console.log('✅ All log calls completed without errors!\n');
    
    console.log('🎉 FRAMEWORK FIXES VALIDATED!');
    console.log('The undefined error has been resolved.');
    console.log('\nYou can now safely run:');
    console.log('1. node test-server.js');
    console.log('2. Open http://localhost:8081/monitor-dashboard.html');
    console.log('3. Click "Run Full Scenario"');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

quickTest();
