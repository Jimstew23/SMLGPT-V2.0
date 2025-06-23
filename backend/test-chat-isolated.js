require('dotenv').config();
const axios = require('axios');

console.log('🧪 ISOLATED CHAT ENDPOINT TEST');
console.log('===============================\n');

// Test 1: Start backend with forced alive mode
console.log('1️⃣ Starting backend server...');
const { spawn } = require('child_process');

const backendProcess = spawn('node', ['server-force-alive.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

let backendReady = false;
let backendOutput = '';

backendProcess.stdout.on('data', (data) => {
  const output = data.toString();
  backendOutput += output;
  console.log('📡 Backend:', output.trim());
  
  if (output.includes('Backend forced alive check') || output.includes('ready to handle requests')) {
    backendReady = true;
  }
});

backendProcess.stderr.on('data', (data) => {
  const output = data.toString();
  console.log('🚨 Backend Error:', output.trim());
});

// Wait for backend to be ready, then test
setTimeout(async () => {
  if (!backendReady) {
    console.log('⏳ Backend still starting, waiting longer...');
    setTimeout(testChatEndpoint, 3000);
  } else {
    await testChatEndpoint();
  }
}, 8000);

async function testChatEndpoint() {
  console.log('\n2️⃣ Testing Chat Endpoint with safety_flags debugging...');
  
  try {
    // Test with include_search=false first (no Azure Search)
    console.log('📋 Test A: Chat WITHOUT search (should work)');
    const responseNoSearch = await axios.post('http://localhost:5000/api/chat', {
      message: 'Hello, test message without search',
      include_search: false
    }, { timeout: 15000 });
    
    console.log('✅ SUCCESS - Chat without search works!');
    console.log('Response preview:', responseNoSearch.data.response.substring(0, 100) + '...');
    
    // Test with include_search=true (this should fail with safety_flags error)
    console.log('\n📋 Test B: Chat WITH search (safety_flags error expected)');
    const responseWithSearch = await axios.post('http://localhost:5000/api/chat', {
      message: 'Tell me about workplace safety',
      include_search: true
    }, { timeout: 15000 });
    
    console.log('🎉 UNEXPECTED SUCCESS - Chat with search also works!');
    console.log('Response preview:', responseWithSearch.data.response.substring(0, 100) + '...');
    console.log('🎯 BREAKTHROUGH: safety_flags issue has been resolved!');
    
  } catch (error) {
    console.log('\n❌ Chat endpoint error detected:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.error || error.message);
    
    if (error.response?.data?.error?.includes('safety_flags')) {
      console.log('\n🎯 CONFIRMED: safety_flags error still exists');
      console.log('📋 This confirms the field reference is still somewhere in the pipeline');
      console.log('💡 Next step: Need to bypass or fix the specific search operation causing this');
    }
  }
  
  // Cleanup
  setTimeout(() => {
    console.log('\n🧹 Cleaning up test process...');
    backendProcess.kill('SIGINT');
    process.exit(0);
  }, 2000);
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  backendProcess.kill('SIGINT');
  process.exit(0);
});
