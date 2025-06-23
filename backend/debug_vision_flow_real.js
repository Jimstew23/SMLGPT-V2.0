const express = require('express');
const documentStore = require('./services/documentStore');
const chatService = require('./services/chatService');
const fs = require('fs');

console.log('🚨 REAL DEBUGGING - TRACING ENTIRE VISION ANALYSIS FLOW');
console.log('='.repeat(80));

// Test 1: Check what documents are actually stored
console.log('\n📋 TEST 1: CHECKING DOCUMENT STORE CONTENTS');
console.log('-'.repeat(50));

try {
  const allDocs = documentStore.getAllDocuments();
  console.log(`📄 Total documents in store: ${allDocs.length}`);
  
  if (allDocs.length > 0) {
    allDocs.forEach((doc, index) => {
      console.log(`\n📄 Document ${index + 1}:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Filename: ${doc.filename}`);
      console.log(`   ContentType: ${doc.contentType}`);
      console.log(`   MimeType: ${doc.mimeType || 'UNDEFINED'}`);
      console.log(`   Has blobUrl: ${!!doc.blobUrl}`);
      console.log(`   BlobUrl: ${doc.blobUrl ? doc.blobUrl.substring(0, 100) + '...' : 'NONE'}`);
      console.log(`   Size: ${doc.size}`);
      console.log(`   Has content: ${!!doc.content}`);
      console.log(`   Content length: ${doc.content ? doc.content.length : 0}`);
    });
  } else {
    console.log('❌ NO DOCUMENTS FOUND IN STORE!');
  }
} catch (error) {
  console.error('❌ ERROR accessing document store:', error);
}

// Test 2: Check isImageFile method
console.log('\n🖼️ TEST 2: CHECKING IMAGE FILE DETECTION');
console.log('-'.repeat(50));

const testFilenames = [
  'IMG_8666.jpeg',
  'test.jpg',
  'image.png',
  'document.pdf'
];

const testMimeTypes = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'application/pdf'
];

testFilenames.forEach((filename, index) => {
  const mimeType = testMimeTypes[index];
  try {
    const isImage = chatService.isImageFile(filename, mimeType);
    console.log(`📄 ${filename} (${mimeType}): ${isImage ? '✅ IS IMAGE' : '❌ NOT IMAGE'}`);
  } catch (error) {
    console.log(`📄 ${filename} (${mimeType}): ❌ ERROR - ${error.message}`);
  }
});

// Test 3: Simulate document reference processing
console.log('\n🔍 TEST 3: SIMULATING DOCUMENT REFERENCE PROCESSING');
console.log('-'.repeat(50));

async function testDocumentReferences() {
  try {
    const allDocs = documentStore.getAllDocuments();
    if (allDocs.length > 0) {
      const firstDoc = allDocs[0];
      console.log(`\n🎯 Testing with document: ${firstDoc.filename}`);
      
      // Test getReferencedImages
      console.log('\n📋 Testing getReferencedImages method...');
      const referencedImages = await chatService.getReferencedImages([firstDoc.id]);
      console.log(`📄 Found ${referencedImages.length} referenced images`);
      
      if (referencedImages.length > 0) {
        referencedImages.forEach((img, index) => {
          console.log(`\n🖼️ Referenced Image ${index + 1}:`);
          console.log(`   ID: ${img.id}`);
          console.log(`   Filename: ${img.filename}`);
          console.log(`   MimeType: ${img.mimeType}`);
          console.log(`   Has blobUrl: ${!!img.blobUrl}`);
          console.log(`   BlobUrl: ${img.blobUrl ? img.blobUrl.substring(0, 100) + '...' : 'NONE'}`);
        });
        
        // Test vision analysis
        console.log('\n🔍 Testing Vision Analysis...');
        const firstImage = referencedImages[0];
        
        try {
          console.log(`📋 Attempting to fetch image from blob: ${firstImage.blobUrl}`);
          const imageBuffer = await chatService.fetchImageFromBlobUrl(firstImage.blobUrl);
          console.log(`✅ Image fetched successfully. Buffer size: ${imageBuffer.length} bytes`);
          
          console.log(`📋 Attempting vision analysis...`);
          const visionResult = await chatService.analyzeImageSafety(
            imageBuffer,
            `Test analysis for ${firstImage.filename}`
          );
          console.log(`✅ Vision analysis completed!`);
          console.log(`📄 Analysis result: ${visionResult.safety_analysis.substring(0, 200)}...`);
          
        } catch (visionError) {
          console.error(`❌ VISION ANALYSIS FAILED:`, visionError);
          console.error(`❌ Error details:`, visionError.message);
          console.error(`❌ Stack trace:`, visionError.stack);
        }
        
      } else {
        console.log('❌ NO IMAGES FOUND FOR ANALYSIS');
      }
      
    } else {
      console.log('❌ NO DOCUMENTS TO TEST WITH');
    }
  } catch (error) {
    console.error('❌ ERROR in document reference testing:', error);
  }
}

// Test 4: Check actual chat processing flow
console.log('\n💬 TEST 4: SIMULATING ACTUAL CHAT REQUEST');
console.log('-'.repeat(50));

async function testChatFlow() {
  try {
    const allDocs = documentStore.getAllDocuments();
    if (allDocs.length > 0) {
      const documentReferences = [allDocs[0].id];
      console.log(`📋 Simulating chat with document references: ${documentReferences}`);
      
      const testMessage = "What hazards do you see in this image?";
      console.log(`📋 Test message: "${testMessage}"`);
      
      // This would normally be called by the chat endpoint
      console.log('\n📋 Calling buildContextFromDocuments...');
      const documentContext = await chatService.buildContextFromDocuments(documentReferences);
      console.log(`📄 Document context length: ${documentContext.length}`);
      console.log(`📄 Document context preview: ${documentContext.substring(0, 300)}...`);
      
      console.log('\n📋 Calling getReferencedImages...');
      const referencedImages = await chatService.getReferencedImages(documentReferences);
      console.log(`🖼️ Referenced images found: ${referencedImages.length}`);
      
      if (referencedImages.length === 0) {
        console.log('❌ CRITICAL: NO IMAGES FOUND FOR VISION ANALYSIS!');
        console.log('❌ This is likely the root cause of the problem.');
      }
      
    } else {
      console.log('❌ NO DOCUMENTS IN STORE TO TEST WITH');
    }
  } catch (error) {
    console.error('❌ ERROR in chat flow testing:', error);
  }
}

// Run all tests
async function runAllTests() {
  await testDocumentReferences();
  await testChatFlow();
  
  console.log('\n🎯 DEBUGGING COMPLETE');
  console.log('='.repeat(80));
  console.log('📋 Check the output above to identify the REAL broken link');
}

runAllTests().catch(console.error);
