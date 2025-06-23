// Load environment variables
require('dotenv').config();

const documentStore = require('./services/documentStore');
const chatService = require('./services/chatService');

console.log('🚨 FOCUSED VISION ANALYSIS DEBUGGING');
console.log('='.repeat(80));

async function debugVisionPipeline() {
  try {
    // Test 1: Check what's actually in document store
    console.log('\n📋 TEST 1: DOCUMENT STORE CONTENTS');
    console.log('-'.repeat(50));
    
    const allDocs = documentStore.getAllDocuments();
    console.log(`📄 Total documents in store: ${allDocs.length}`);
    
    if (allDocs.length === 0) {
      console.log('❌ CRITICAL: NO DOCUMENTS IN STORE!');
      console.log('❌ This means either:');
      console.log('   1. No images have been uploaded');
      console.log('   2. Upload process is not storing documents');
      console.log('   3. Document store is not persisting data');
      return;
    }
    
    // Find image documents
    const imageDocs = allDocs.filter(doc => 
      doc.contentType && doc.contentType.startsWith('image/')
    );
    
    console.log(`🖼️ Image documents found: ${imageDocs.length}`);
    
    if (imageDocs.length === 0) {
      console.log('❌ CRITICAL: NO IMAGE DOCUMENTS IN STORE!');
      console.log('❌ Uploaded files are not being recognized as images');
      
      // Show what's actually stored
      allDocs.forEach((doc, index) => {
        console.log(`\n📄 Document ${index + 1}:`);
        console.log(`   Filename: ${doc.filename}`);
        console.log(`   ContentType: ${doc.contentType}`);
        console.log(`   Has blobUrl: ${!!doc.blobUrl}`);
      });
      return;
    }
    
    // Test 2: Test Vision analysis on first image
    console.log('\n📋 TEST 2: VISION ANALYSIS TEST');
    console.log('-'.repeat(50));
    
    const firstImage = imageDocs[0];
    console.log(`🎯 Testing with: ${firstImage.filename}`);
    console.log(`📄 ContentType: ${firstImage.contentType}`);
    console.log(`📄 BlobUrl: ${firstImage.blobUrl ? firstImage.blobUrl.substring(0, 100) + '...' : 'MISSING'}`);
    
    if (!firstImage.blobUrl) {
      console.log('❌ CRITICAL: IMAGE HAS NO BLOB URL!');
      console.log('❌ Cannot fetch image for analysis');
      return;
    }
    
    // Test 3: Fetch image from blob storage
    console.log('\n📋 TEST 3: BLOB STORAGE ACCESS');
    console.log('-'.repeat(50));
    
    try {
      console.log('📋 Fetching image from blob storage...');
      const imageBuffer = await chatService.fetchImageFromBlobUrl(firstImage.blobUrl);
      console.log(`✅ Image fetched successfully!`);
      console.log(`📄 Buffer size: ${imageBuffer.length} bytes`);
      
      // Test 4: Vision analysis
      console.log('\n📋 TEST 4: VISION ANALYSIS');
      console.log('-'.repeat(50));
      
      console.log('📋 Performing safety vision analysis...');
      const visionResult = await chatService.analyzeImageSafety(
        imageBuffer,
        'Identify all safety hazards in this image'
      );
      
      console.log('✅ VISION ANALYSIS SUCCESSFUL!');
      console.log(`📄 Analysis result: ${visionResult.safety_analysis.substring(0, 500)}...`);
      
      // Test 5: Complete chat flow simulation
      console.log('\n📋 TEST 5: COMPLETE CHAT FLOW SIMULATION');
      console.log('-'.repeat(50));
      
      const documentReferences = [firstImage.id];
      console.log(`📋 Simulating chat with document references: ${documentReferences}`);
      
      const referencedImages = await chatService.getReferencedImages(documentReferences);
      console.log(`🖼️ getReferencedImages returned: ${referencedImages.length} images`);
      
      if (referencedImages.length === 0) {
        console.log('❌ CRITICAL: getReferencedImages returned no images!');
        console.log('❌ This is the broken link - chat can\'t find the uploaded images');
        
        // Debug getReferencedImages
        console.log('\n🔍 DEBUGGING getReferencedImages:');
        console.log(`📄 Document ID being searched: ${firstImage.id}`);
        
        const retrievedDoc = documentStore.getDocument(firstImage.id);
        console.log(`📄 Document retrieved by ID: ${!!retrievedDoc}`);
        
        if (retrievedDoc) {
          console.log(`📄 Retrieved filename: ${retrievedDoc.filename}`);
          console.log(`📄 Retrieved contentType: ${retrievedDoc.contentType}`);
          
          const isImageResult = chatService.isImageFile(retrievedDoc.filename, retrievedDoc.contentType);
          console.log(`📄 isImageFile result: ${isImageResult}`);
        }
      } else {
        console.log('✅ getReferencedImages working correctly!');
        console.log('✅ ALL VISION ANALYSIS COMPONENTS WORKING!');
      }
      
    } catch (blobError) {
      console.log(`❌ BLOB STORAGE ACCESS FAILED: ${blobError.message}`);
      console.log('❌ This is the broken link - cannot fetch images from blob storage');
    }
    
  } catch (visionError) {
    console.log(`❌ VISION ANALYSIS FAILED: ${visionError.message}`);
    console.log('❌ This is the broken link - Vision service not working');
    console.log(`❌ Stack: ${visionError.stack}`);
  }
}

// Initialize and run test
debugVisionPipeline().then(() => {
  console.log('\n🎯 FOCUSED DEBUGGING COMPLETE');
  console.log('='.repeat(80));
}).catch(console.error);
