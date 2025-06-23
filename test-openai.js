// Direct Azure OpenAI GPT-4.1 Test
const https = require('https');

const endpoint = 'sml-image-analysis-eastus.cognitiveservices.azure.com';
const path = '/openai/deployments/gpt-4.1/chat/completions?api-version=2024-12-01-preview';
const apiKey = '77jQ77rTh5XiVfbaDb9LBeI2UzYrmxXftQNbOZhWnZdaQTiEnVv5JQQJ99BCACYeBjFXJ3w3AAAAACOGhXPp';

const data = JSON.stringify({
  messages: [
    {
      role: "user",
      content: "Hello! Test GPT-4.1 response - please confirm you are working."
    }
  ],
  max_tokens: 150,
  temperature: 0.7
});

const options = {
  hostname: endpoint,
  path: path,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'api-key': apiKey
  }
};

console.log('🚀 TESTING AZURE OPENAI GPT-4.1 DIRECT CONNECTION...');
console.log(`Endpoint: https://${endpoint}${path}`);
console.log(`API Key: ${apiKey.substring(0, 10)}...`);

const req = https.request(options, (res) => {
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
      if (jsonResponse.choices && jsonResponse.choices[0] && jsonResponse.choices[0].message) {
        console.log('\n🎉 GPT-4.1 SUCCESS! MESSAGE:');
        console.log(jsonResponse.choices[0].message.content);
      } else {
        console.log('\n❌ NO MESSAGE IN RESPONSE');
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
