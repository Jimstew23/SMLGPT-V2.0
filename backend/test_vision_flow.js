/**
 * Comprehensive Vision Analysis Flow Test
 * Tests the complete image upload → document store → vision analysis pipeline
 */

const ChatService = require('./services/chatService');
const documentStore = require('./services/documentStore');
const logger = require('./utils/logger');

async function testVisionAnalysisFlow() {
  console.log('🔍 TESTING COMPLETE VISION ANALYSIS FLOW...\n');
  
  try {
    // Step 1: Initialize ChatService
    console.log('Step 1: Initializing ChatService...');
    const chatService = new ChatService();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for initialization
    console.log('✅ ChatService initialized\n');
    
    // Step 2: Create mock image document in document store
    console.log('Step 2: Creating mock image document...');
    const mockImageDoc = {
      id: 'test-image-123',
      filename: 'test-safety-image.jpg',
      mimeType: 'image/jpeg',
      size: 1024000,
      blobUrl: 'https://smlimageanalysisstorage.blob.core.windows.net/images/test-safety-image.jpg',
      extractedText: '',
      uploadedAt: new Date().toISOString(),
      metadata: { source: 'test' }
    };
    
    // Store the mock document
    documentStore.storeDocument(mockImageDoc);
    console.log('✅ Mock image document stored:', mockImageDoc.filename);
    console.log('   - Document ID:', mockImageDoc.id);
    console.log('   - MIME Type:', mockImageDoc.mimeType);
    console.log('   - Blob URL:', mockImageDoc.blobUrl);
    console.log('');
    
    // Step 3: Test getReferencedImages method
    console.log('Step 3: Testing getReferencedImages method...');
    const referencedImages = await chatService.getReferencedImages([mockImageDoc.id]);
    console.log('✅ Retrieved referenced images:', referencedImages.length);
    
    if (referencedImages.length > 0) {
      console.log('   - Image found:', referencedImages[0].filename);
      console.log('   - Has blob URL:', !!referencedImages[0].blobUrl);
    } else {
      console.log('❌ No images found - checking document store...');
      const stored = documentStore.getDocument(mockImageDoc.id);
      console.log('   - Document in store:', !!stored);
      if (stored) {
        console.log('   - Is image file:', chatService.isImageFile(stored.filename, stored.mimeType));
      }
    }
    console.log('');
    
    // Step 4: Test complete chat flow with image reference
    console.log('Step 4: Testing complete chat flow with image reference...');
    const chatRequest = {
      message: 'What safety hazards do you see in this image?',
      conversation_id: 'test-conv-123',
      include_search: false,
      document_references: [mockImageDoc.id]
    };
    
    console.log('Chat request:', JSON.stringify(chatRequest, null, 2));
    console.log('Processing chat request...\n');
    
    const startTime = Date.now();
    const response = await chatService.processChat(chatRequest);
    const processingTime = Date.now() - startTime;
    
    console.log('✅ Chat processing completed in', processingTime, 'ms');
    console.log('Response length:', response.response.length, 'characters');
    console.log('Model used:', response.model_used);
    console.log('');
    
    // Step 5: Analyze response for Vision analysis indicators
    console.log('Step 5: Analyzing response for Vision analysis indicators...');
    const responseText = response.response.toLowerCase();
    
    const visionIndicators = [
      'image', 'see', 'visual', 'picture', 'photo', 'shown', 'visible', 'observe',
      'hazard', 'safety', 'risk', 'ppe', 'equipment', 'worker', 'environment'
    ];
    
    const foundIndicators = visionIndicators.filter(indicator => 
      responseText.includes(indicator)
    );
    
    console.log('Found vision/safety indicators:', foundIndicators.length);
    console.log('Indicators:', foundIndicators.join(', '));
    
    // Check for "I don't have access" or similar negative responses
    const negativeIndicators = [
      "don't have access", "cannot see", "unable to view", "cannot view",
      "no access", "cannot analyze", "unable to analyze"
    ];
    
    const foundNegative = negativeIndicators.filter(indicator => 
      responseText.includes(indicator)
    );
    
    if (foundNegative.length > 0) {
      console.log('❌ NEGATIVE INDICATORS FOUND:', foundNegative);
      console.log('   Vision analysis may still be failing!');
    } else {
      console.log('✅ No negative indicators found - Vision analysis likely working!');
    }
    
    console.log('\n📋 RESPONSE PREVIEW:');
    console.log('---');
    console.log(response.response.substring(0, 300) + '...');
    console.log('---\n');
    
    // Step 6: Final assessment
    console.log('Step 6: Final Vision Analysis Assessment...');
    const isWorking = foundIndicators.length >= 3 && foundNegative.length === 0;
    
    if (isWorking) {
      console.log('🎯 SUCCESS: Vision analysis appears to be working correctly!');
      console.log('   - Found', foundIndicators.length, 'vision/safety indicators');
      console.log('   - No negative access indicators');
      console.log('   - Response contains detailed content');
    } else {
      console.log('❌ ISSUES: Vision analysis may still have problems');
      console.log('   - Found indicators:', foundIndicators.length);
      console.log('   - Negative indicators:', foundNegative.length);
      console.log('   - Check logs for specific errors');
    }
    
  } catch (error) {
    console.error('❌ Vision analysis test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testVisionAnalysisFlow().then(() => {
  console.log('\n🔍 Vision analysis flow test complete!');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
