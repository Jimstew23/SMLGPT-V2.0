const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_FILES_DIR = './test-files'; // Directory containing test files

// Test file paths (create these test files)
const TEST_CASES = [
  {
    name: 'safety-image-test',
    file: 'workplace-safety-scene.jpg',
    type: 'image',
    description: 'Testing image analysis for workplace safety hazards'
  },
  {
    name: 'document-test',
    file: 'safety-procedures.pdf',
    type: 'document',
    description: 'Testing document analysis for safety procedures'
  },
  {
    name: 'hazard-image-test',
    file: 'construction-site.png',
    type: 'image',
    description: 'Testing construction site hazard detection'
  }
];

/**
 * Upload a file and get analysis results
 */
async function uploadFile(filePath, analysisType = 'safety') {
  try {
    console.log(`\n📤 Uploading file: ${path.basename(filePath)}`);
    
    // Create form data
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    const fileName = path.basename(filePath);
    
    form.append('file', fileStream, fileName);
    form.append('analysis_type', analysisType);
    
    // Make upload request
    const startTime = Date.now();
    const response = await axios.post(`${API_BASE_URL}/api/upload`, form, {
      headers: {
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        process.stdout.write(`\rUpload Progress: ${percentCompleted}%`);
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ Upload completed in ${duration}ms`);
    
    return response.data;
  } catch (error) {
    console.error(`\n❌ Upload failed: ${error.message}`);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Send a chat message referencing uploaded documents
 */
async function sendChatMessage(message, documentIds = []) {
  try {
    console.log(`\n💬 Sending chat message with ${documentIds.length} document references`);
    
    const response = await axios.post(`${API_BASE_URL}/api/chat`, {
      message,
      conversation_history: [],
      include_context: true,
      document_references: documentIds,
      max_tokens: 2000
    });
    
    return response.data;
  } catch (error) {
    console.error(`\n❌ Chat request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test the complete flow
 */
async function testCompleteFlow() {
  console.log('🚀 Starting SMLGPT V2.0 File Upload Test\n');
  console.log('='.repeat(50));
  
  const uploadedFiles = [];
  
  // Test 1: Upload and analyze individual files
  for (const testCase of TEST_CASES) {
    console.log(`\n\n📋 Test Case: ${testCase.name}`);
    console.log(`Description: ${testCase.description}`);
    console.log('-'.repeat(50));
    
    const filePath = path.join(TEST_FILES_DIR, testCase.file);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping - File not found: ${filePath}`);
      continue;
    }
    
    try {
      // Upload file
      const uploadResult = await uploadFile(filePath);
      uploadedFiles.push(uploadResult);
      
      // Display results
      console.log('\n📊 Analysis Results:');
      console.log(`File ID: ${uploadResult.file_id}`);
      console.log(`Blob URL: ${uploadResult.blob_url}`);
      console.log(`Processing Time: ${uploadResult.processing_time_ms}ms`);
      console.log(`Indexed: ${uploadResult.indexed}`);
      
      if (uploadResult.analysis) {
        if (testCase.type === 'image' && uploadResult.analysis.vision_analysis) {
          console.log('\n🖼️  Vision Analysis:');
          console.log(`Caption: ${uploadResult.analysis.vision_analysis.caption}`);
          console.log(`Tags: ${uploadResult.analysis.vision_analysis.tags?.join(', ')}`);
          console.log(`Objects: ${uploadResult.analysis.vision_analysis.objects?.join(', ')}`);
        }
        
        if (uploadResult.analysis.safety_analysis) {
          console.log('\n🦺 Safety Analysis Preview:');
          const preview = uploadResult.analysis.safety_analysis.substring(0, 500);
          console.log(preview + '...');
        }
      }
      
    } catch (error) {
      console.error(`Failed to process ${testCase.file}:`, error.message);
    }
  }
  
  // Test 2: Chat with document references
  if (uploadedFiles.length > 0) {
    console.log('\n\n🤖 Testing Chat with Document References');
    console.log('='.repeat(50));
    
    const documentIds = uploadedFiles.map(f => f.file_id);
    
    try {
      // Send a message referencing the uploaded files
      const chatResponse = await sendChatMessage(
        "Analyze the safety hazards in the uploaded images and documents. What are the most critical risks?",
        documentIds
      );
      
      console.log('\n💬 Chat Response:');
      console.log(chatResponse.response.substring(0, 1000) + '...');
      console.log(`\nProcessing Time: ${chatResponse.processing_time_ms}ms`);
      console.log(`Context Used: ${chatResponse.context_used}`);
      
    } catch (error) {
      console.error('Chat test failed:', error.message);
    }
  }
  
  // Summary
  console.log('\n\n📈 Test Summary');
  console.log('='.repeat(50));
  console.log(`Total files uploaded: ${uploadedFiles.length}`);
  console.log(`Successful uploads: ${uploadedFiles.filter(f => f.status === 'success').length}`);
  
  return uploadedFiles;
}

/**
 * Test specific Azure service integrations
 */
async function testAzureServices() {
  console.log('\n\n🔷 Testing Azure Service Integration');
  console.log('='.repeat(50));
  
  // Test Computer Vision
  console.log('\n1. Testing Azure Computer Vision:');
  const imageFile = path.join(TEST_FILES_DIR, 'test-workplace.jpg');
  if (fs.existsSync(imageFile)) {
    const result = await uploadFile(imageFile);
    if (result.analysis?.vision_analysis) {
      console.log('✅ Computer Vision working');
      console.log(`   Detected: ${result.analysis.vision_analysis.description}`);
    }
  }
  
  // Test Document Intelligence
  console.log('\n2. Testing Azure Document Intelligence:');
  const docFile = path.join(TEST_FILES_DIR, 'test-document.pdf');
  if (fs.existsSync(docFile)) {
    const result = await uploadFile(docFile);
    if (result.analysis?.content) {
      console.log('✅ Document Intelligence working');
      console.log(`   Extracted ${result.analysis.content.length} characters`);
    }
  }
}

/**
 * Load test for performance evaluation
 */
async function loadTest(concurrentUploads = 3, totalUploads = 10) {
  console.log(`\n\n⚡ Load Test: ${totalUploads} uploads with ${concurrentUploads} concurrent`);
  console.log('='.repeat(50));
  
  const testFile = path.join(TEST_FILES_DIR, 'test-image.jpg');
  if (!fs.existsSync(testFile)) {
    console.log('❌ Load test file not found');
    return;
  }
  
  const startTime = Date.now();
  const results = [];
  
  // Create upload promises
  const uploadPromises = [];
  for (let i = 0; i < totalUploads; i++) {
    const promise = uploadFile(testFile).then(result => {
      results.push({ success: true, time: result.processing_time_ms });
      return result;
    }).catch(error => {
      results.push({ success: false, error: error.message });
      return null;
    });
    
    uploadPromises.push(promise);
    
    // Control concurrency
    if ((i + 1) % concurrentUploads === 0) {
      await Promise.all(uploadPromises.slice(-concurrentUploads));
    }
  }
  
  // Wait for remaining uploads
  await Promise.all(uploadPromises);
  
  const totalTime = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const avgProcessingTime = results
    .filter(r => r.success && r.time)
    .reduce((sum, r) => sum + r.time, 0) / successCount || 0;
  
  console.log('\n📊 Load Test Results:');
  console.log(`Total Time: ${totalTime}ms`);
  console.log(`Successful: ${successCount}/${totalUploads}`);
  console.log(`Average Processing Time: ${avgProcessingTime.toFixed(0)}ms`);
  console.log(`Throughput: ${(totalUploads / (totalTime / 1000)).toFixed(2)} uploads/second`);
}

/**
 * Main test runner
 */
async function main() {
  console.log('🏁 SMLGPT V2.0 API Test Suite\n');
  
  // Check if test files directory exists
  if (!fs.existsSync(TEST_FILES_DIR)) {
    console.log(`Creating test files directory: ${TEST_FILES_DIR}`);
    fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
    console.log('\n⚠️  Please add test files to the directory:');
    TEST_CASES.forEach(tc => {
      console.log(`   - ${tc.file}: ${tc.description}`);
    });
    return;
  }
  
  try {
    // Check API health
    console.log('🏥 Checking API health...');
    const health = await axios.get(`${API_BASE_URL}/api/health`);
    console.log(`✅ API Status: ${health.data.status}\n`);
    
    // Run tests based on command line arguments
    const testType = process.argv[2] || 'all';
    
    switch (testType) {
      case 'upload':
        await testCompleteFlow();
        break;
      case 'azure':
        await testAzureServices();
        break;
      case 'load':
        const concurrent = parseInt(process.argv[3]) || 3;
        const total = parseInt(process.argv[4]) || 10;
        await loadTest(concurrent, total);
        break;
      case 'all':
      default:
        await testCompleteFlow();
        await testAzureServices();
        await loadTest(3, 10);
        break;
    }
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  uploadFile,
  sendChatMessage,
  testCompleteFlow,
  testAzureServices,
  loadTest
};
