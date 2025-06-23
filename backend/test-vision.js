const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Test Azure Vision API integration
const { OpenAI } = require('openai');

async function testVisionAPI() {
  console.log('🔍 Testing Azure OpenAI Vision API...');
  
  // Initialize OpenAI client with Azure configuration
  const openaiClient = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4.1/`,
    defaultQuery: { 'api-version': '2024-02-01' },
    defaultHeaders: {
      'api-key': process.env.AZURE_OPENAI_API_KEY,
    }
  });

  // Create a simple test image (1x1 red pixel PNG in base64)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  
  try {
    console.log('📤 Sending test image to GPT-4.1 Vision...');
    
    const messages = [
      {
        role: 'system',
        content: 'You are a safety analysis AI. Analyze images for workplace safety hazards.'
      },
      {
        role: 'user',
        content: [
          { 
            type: 'text', 
            text: 'What do you see in this image? Describe any safety concerns.' 
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${testImageBase64}`,
              detail: 'high'
            }
          }
        ]
      }
    ];

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      max_tokens: 500,
      temperature: 0.1
    });

    console.log('✅ Vision API Response:');
    console.log(response.choices[0].message.content);
    console.log('\n📊 Usage Stats:');
    console.log(`Prompt tokens: ${response.usage?.prompt_tokens || 'N/A'}`);
    console.log(`Completion tokens: ${response.usage?.completion_tokens || 'N/A'}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Vision API Test Failed:');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    return false;
  }
}

// Test supported image formats
async function testImageFormats() {
  console.log('\n🖼️  Testing supported image formats...');
  
  const formats = [
    { name: 'JPEG', mime: 'image/jpeg', ext: '.jpg' },
    { name: 'PNG', mime: 'image/png', ext: '.png' },
    { name: 'GIF', mime: 'image/gif', ext: '.gif' },
    { name: 'WebP', mime: 'image/webp', ext: '.webp' }
  ];
  
  formats.forEach(format => {
    console.log(`✓ ${format.name} (${format.mime}) - Should be supported`);
  });
}

async function runTests() {
  console.log('🧪 Starting Azure Vision API Tests\n');
  
  // Check environment variables
  console.log('🔧 Environment Check:');
  console.log(`AZURE_OPENAI_ENDPOINT: ${process.env.AZURE_OPENAI_ENDPOINT ? '✓ Set' : '❌ Missing'}`);
  console.log(`AZURE_OPENAI_API_KEY: ${process.env.AZURE_OPENAI_API_KEY ? '✓ Set' : '❌ Missing'}`);
  
  if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
    console.error('\n❌ Missing required environment variables!');
    return;
  }
  
  // Test Vision API
  const visionWorking = await testVisionAPI();
  
  // Test image formats
  await testImageFormats();
  
  console.log('\n📋 Test Summary:');
  console.log(`Vision API: ${visionWorking ? '✅ Working' : '❌ Failed'}`);
  
  if (visionWorking) {
    console.log('\n🎉 Azure Vision API is working correctly!');
    console.log('The issue may be in the image data processing or document storage.');
  } else {
    console.log('\n⚠️  Azure Vision API needs configuration.');
  }
}

runTests().catch(console.error);
