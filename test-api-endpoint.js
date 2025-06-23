// Test /api/chat endpoint end-to-end
const https = require('https');
const http = require('http');

function testApiEndpoint() {
  console.log('🚀 TESTING /API/CHAT ENDPOINT END-TO-END...');
  
  const data = JSON.stringify({
    message: "Hello! Please respond to confirm end-to-end GPT-4.1 chat works through /api/chat",
    include_search: false // Disable search to isolate GPT-4.1
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Origin': 'http://localhost:3000'
    }
  };

  console.log('📡 Sending request to http://localhost:5000/api/chat');
  console.log('📦 Payload:', data);

  const req = http.request(options, (res) => {
    console.log(`\n✅ STATUS CODE: ${res.statusCode}`);
    console.log(`✅ HEADERS:`, res.headers);
    
    let responseBody = '';
    
    res.on('data', (chunk) => {
      responseBody += chunk;
    });
    
    res.on('end', () => {
      console.log('\n🎯 RESPONSE BODY:');
      console.log(responseBody);
      
      try {
        const jsonResponse = JSON.parse(responseBody);
        if (jsonResponse.response) {
          console.log('\n🎉 SUCCESS! GPT-4.1 RESPONSE THROUGH /API/CHAT:');
          console.log('✅ Message:', jsonResponse.response);
          console.log('✅ Model Used:', jsonResponse.model_used);
          console.log('✅ Processing Time:', jsonResponse.processing_time_ms + 'ms');
        } else {
          console.log('\n❌ NO RESPONSE IN JSON');
        }
      } catch (error) {
        console.log('\n❌ FAILED TO PARSE JSON:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('\n🚨 REQUEST ERROR:', error);
  });

  req.write(data);
  req.end();
}

testApiEndpoint();
