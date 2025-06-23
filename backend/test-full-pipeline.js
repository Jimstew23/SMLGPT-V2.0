require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Test the complete image upload → vision analysis pipeline
async function testFullPipeline() {
  console.log('🔍 TESTING COMPLETE IMAGE UPLOAD → GPT-4.1 VISION ANALYSIS PIPELINE');
  console.log('================================================================\n');

  // Step 1: Test backend health
  console.log('1️⃣ Testing backend health...');
  try {
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Backend healthy:', healthResponse.data);
  } catch (error) {
    console.error('❌ Backend health check failed:', error.message);
    return;
  }

  // Step 2: Test image upload endpoint
  console.log('\n2️⃣ Testing image upload...');
  
  // Check if test image exists, if not create a simple test image path
  const testImagePath = path.join(__dirname, 'test-images', 'safety-test.jpg');
  if (!fs.existsSync(testImagePath)) {
    console.log('⚠️ Test image not found. Please upload an image manually via the web app for this test.');
    console.log('   Expected path:', testImagePath);
    console.log('   Or use any image file for testing.\n');
  }

  // For now, let's test with a mock file upload scenario
  console.log('📤 Simulating image upload flow...');

  // Step 3: Test document store integration
  console.log('\n3️⃣ Testing document store integration...');
  try {
    const documentStore = require('./services/documentStore');
    console.log('✅ Document store loaded successfully');
    
    // List current documents
    const docs = documentStore.getAllDocuments();
    console.log(`📁 Current documents in store: ${docs.length}`);
    docs.forEach(doc => {
      console.log(`   - ${doc.filename} (${doc.contentType}) - ID: ${doc.id}`);
    });
  } catch (error) {
    console.error('❌ Document store test failed:', error.message);
  }

  // Step 4: Test chat service with image analysis
  console.log('\n4️⃣ Testing chat service with vision analysis...');
  try {
    const chatService = require('./services/chatService');
    console.log('✅ Chat service loaded successfully');

    // Get documents from store to test with
    const documentStore = require('./services/documentStore');
    const docs = documentStore.getAllDocuments();
    const imageDoc = docs.find(doc => doc.contentType && doc.contentType.startsWith('image/'));

    if (imageDoc) {
      console.log(`🖼️ Found test image: ${imageDoc.filename}`);
      console.log(`   - Blob URL: ${imageDoc.blobUrl}`);
      console.log(`   - Content Type: ${imageDoc.contentType}`);
      
      // Test vision analysis
      console.log('\n🔬 Testing vision analysis...');
      const testMessage = "What safety hazards do you see in this image?";
      
      console.log('📨 Sending chat request with image reference...');
      const chatResponse = await chatService.processChat({
        message: testMessage,
        conversation_id: `test_${Date.now()}`,
        include_search: false,
        document_references: [imageDoc.id]
      });

      console.log('✅ Chat response received:');
      console.log('   - Response length:', chatResponse.response.length);
      console.log('   - Processing time:', chatResponse.processingTime);
      console.log('   - Has safety analysis:', !!chatResponse.safety_analysis);
      console.log('   - Response preview:', chatResponse.response.substring(0, 200) + '...');

    } else {
      console.log('⚠️ No image documents found in store for testing');
      console.log('   Please upload an image via the web app first');
    }

  } catch (error) {
    console.error('❌ Chat service test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }

  // Step 5: Test API endpoints directly
  console.log('\n5️⃣ Testing API endpoints...');
  
  try {
    // Test chat endpoint
    console.log('📡 Testing /api/chat endpoint...');
    const chatRequest = {
      message: "Hello, can you help me analyze workplace safety?",
      conversation_id: `test_${Date.now()}`,
      include_search: false,
      document_references: []
    };

    const chatResponse = await axios.post('http://localhost:5000/api/chat', chatRequest);
    if (chatResponse.status === 200) {
      console.log('✅ Chat endpoint working');
      console.log('   - Response length:', chatResponse.data.response.length);
      console.log('   - Model used:', chatResponse.data.model || 'Unknown');
    } else {
      console.error('❌ Chat endpoint failed:', chatResponse.status, chatResponse.statusText);
      console.error('   Error details:', chatResponse.data);
    }

  } catch (error) {
    console.error('❌ API endpoint test failed:', error.message);
  }

  console.log('\n🏁 PIPELINE TEST COMPLETE');
  console.log('================================================================');
}

// Helper function to test specific image analysis
async function testImageAnalysis(imagePath, testMessage) {
  console.log('\n🧪 DIRECT IMAGE ANALYSIS TEST');
  console.log('==============================');
  
  try {
    if (!fs.existsSync(imagePath)) {
      console.log('❌ Image file not found:', imagePath);
      return;
    }

    const chatService = require('./services/chatService');
    const imageBuffer = fs.readFileSync(imagePath);
    
    console.log('📸 Testing direct image analysis...');
    console.log('   - Image path:', imagePath);
    console.log('   - Image size:', imageBuffer.length, 'bytes');
    console.log('   - Test message:', testMessage);

    const result = await chatService.analyzeImageSafety(imageBuffer, testMessage);
    
    console.log('✅ Direct image analysis result:');
    console.log('   - Analysis length:', result.safety_analysis.length);
    console.log('   - Processing time:', result.processingTime);
    console.log('   - Analysis preview:', result.safety_analysis.substring(0, 300) + '...');

  } catch (error) {
    console.error('❌ Direct image analysis failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testFullPipeline().catch(console.error);
}

module.exports = { testFullPipeline, testImageAnalysis };
