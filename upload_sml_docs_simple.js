#!/usr/bin/env node

/**
 * SMLGPT V2.0 - Simplified SML Documentation Upload Script
 * Fixed version to reliably upload all SML documents to AI knowledge base
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 5000;
const SML_DOCS_PATH = 'c:\\Users\\jimst\\Desktop\\SMLGPT\\SML Documentation';

// Supported file types
const SUPPORTED_EXTENSIONS = ['.docx', '.doc', '.pdf', '.txt'];

/**
 * Create multipart form data manually (simpler than node-fetch)
 */
function createMultipartData(filePath, filename) {
  const fileData = fs.readFileSync(filePath);
  const boundary = '----FormBoundary' + Math.random().toString(16);
  
  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
  body += `Content-Type: application/octet-stream\r\n\r\n`;
  
  // Convert body to buffer and append file data
  const bodyBuffer = Buffer.from(body, 'utf8');
  const endBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  
  return {
    data: Buffer.concat([bodyBuffer, fileData, endBuffer]),
    boundary: boundary
  };
}

/**
 * Upload a single document using native HTTP
 */
function uploadDocument(filePath, filename) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📄 Processing: ${filename}`);
      
      const fileSize = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
      console.log(`   Size: ${fileSize} MB`);
      
      // Create multipart form data
      const { data, boundary } = createMultipartData(filePath, filename);
      
      // HTTP request options
      const options = {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: '/api/upload',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': data.length
        }
      };
      
      console.log(`   📤 Uploading to AI knowledge base...`);
      
      // Create HTTP request
      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 200 || res.statusCode === 201) {
              const result = JSON.parse(responseData);
              console.log(`   ✅ Success! Document uploaded to AI knowledge base`);
              console.log(`   🧠 File ID: ${result.file_id || 'Generated'}`);
              console.log(`   ⚡ Status: ${result.indexed ? 'Indexed' : 'Processing'}`);
              console.log('');
              resolve(result);
            } else {
              console.log(`   ❌ Failed: HTTP ${res.statusCode}`);
              console.log(`   Response: ${responseData}`);
              console.log('');
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          } catch (parseError) {
            console.log(`   ❌ Failed to parse response: ${parseError.message}`);
            console.log(`   Raw response: ${responseData}`);
            console.log('');
            reject(parseError);
          }
        });
      });
      
      // Handle request errors
      req.on('error', (error) => {
        console.log(`   ❌ Request failed: ${error.message}`);
        console.log('');
        reject(error);
      });
      
      // Set timeout
      req.setTimeout(120000, () => {
        console.log(`   ❌ Upload timeout (2 minutes)`);
        console.log('');
        req.destroy();
        reject(new Error('Upload timeout'));
      });
      
      // Send the request
      req.write(data);
      req.end();
      
    } catch (error) {
      console.log(`   ❌ Error preparing upload: ${error.message}`);
      console.log('');
      reject(error);
    }
  });
}

/**
 * Check if backend is running
 */
function checkBackend() {
  return new Promise((resolve) => {
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Backend is healthy and ready');
        resolve(true);
      } else {
        console.log(`❌ Backend unhealthy: HTTP ${res.statusCode}`);
        resolve(false);
      }
    });
    
    req.on('error', () => {
      console.log('❌ Backend not responding');
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('❌ Backend health check timeout');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

/**
 * Main upload process
 */
async function uploadAllSMLDocuments() {
  console.log('🧠 SMLGPT V2.0 - SML Documentation Upload (Simplified)');
  console.log('=' .repeat(60));
  console.log('📚 Building AI knowledge base with Georgia-Pacific SML standards...');
  console.log('');
  
  // Check backend
  console.log('🔍 Checking backend status...');
  const backendOk = await checkBackend();
  if (!backendOk) {
    console.log('❌ Please ensure SMLGPT V2.0 backend is running on port 5000');
    process.exit(1);
  }
  console.log('');
  
  // Get SML documents
  console.log(`📁 Scanning: ${SML_DOCS_PATH}`);
  const files = fs.readdirSync(SML_DOCS_PATH);
  const smlDocs = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  });
  
  console.log(`📄 Found ${smlDocs.length} SML documents to upload`);
  console.log('');
  
  // Upload statistics
  let successful = 0;
  let failed = 0;
  
  // Process each document
  for (let i = 0; i < smlDocs.length; i++) {
    const filename = smlDocs[i];
    const filePath = path.join(SML_DOCS_PATH, filename);
    
    console.log(`[${i + 1}/${smlDocs.length}] Processing:`);
    
    try {
      await uploadDocument(filePath, filename);
      successful++;
    } catch (error) {
      failed++;
    }
    
    // Brief delay between uploads
    if (i < smlDocs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Final summary
  console.log('=' .repeat(60));
  console.log('🎉 SML Documentation Upload Complete!');
  console.log('');
  console.log(`📊 Summary:`);
  console.log(`   ✅ Successful uploads: ${successful}`);
  console.log(`   ❌ Failed uploads: ${failed}`);
  console.log(`   📚 Documents in AI knowledge base: ${successful}`);
  console.log('');
  
  if (successful > 0) {
    console.log('🧠 Your AI now has comprehensive SML knowledge:');
    console.log('   • Georgia-Pacific SML 2025 standards');
    console.log('   • All work category deep dive controls');
    console.log('   • Critical hazard compliance procedures');
    console.log('   • Safety audit protocols and training docs');
    console.log('');
    console.log('🎯 Ready for comprehensive safety analysis!');
  }
  
  console.log('');
  console.log('🚀 Test your AI knowledge base in the frontend chat!');
}

// Run the upload
if (require.main === module) {
  uploadAllSMLDocuments().catch(console.error);
}

module.exports = { uploadAllSMLDocuments };
