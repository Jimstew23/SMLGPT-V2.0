#!/usr/bin/env node

/**
 * SMLGPT V2.0 - Official SML Documentation Batch Upload Script
 * 
 * This script uploads all official SML/GP safety documents to the AI knowledge base
 * for comprehensive safety analysis and compliance checking.
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Configuration
const BACKEND_URL = 'http://localhost:5000';
const SML_DOCS_PATH = 'c:\\Users\\jimst\\Desktop\\SMLGPT\\SML Documentation';
const UPLOAD_ENDPOINT = `${BACKEND_URL}/api/upload`;

// Supported file types for SML documentation
const SUPPORTED_EXTENSIONS = ['.docx', '.doc', '.pdf', '.txt'];

// Categories for better organization
const DOCUMENT_CATEGORIES = {
  'Save My Life Compliance Standard 2025.docx': 'core_standard',
  'SML CRITICAL CONTROLS DEEP DIVE.pdf': 'core_standard', 
  'SML Acceptor Guide.pdf': 'core_standard',
  'SML Audit Protocol 2025.docx': 'audit_protocol',
  'New training docs for SML 2.0.pdf': 'training',
  'Controls Deep Dive': 'work_category_controls',
  'Electrical Safe Work Practice': 'electrical_safety',
  'Hot Work Permit Standard': 'hot_work',
  'Lock, Tag, Verify Standard': 'isolation_energy',
  'Fall Protection Compliance': 'height_safety',
  'Lifting and Rigging Permit': 'lifting_rigging',
  'Mobile Equipment (MOPED)': 'mobile_equipment',
  'Emergency Preparedness': 'emergency_response',
  'Investigation, Reporting': 'incident_management',
  'Hazard Communication': 'hazcom',
  'Personal Protective Equipment': 'ppe',
  'Respiratory Protection': 'respiratory',
  'Asbestos Compliance': 'hazardous_materials',
  'Lead Based Paint': 'hazardous_materials',
  'Combustible Dust': 'hazardous_materials',
  'Formaldehyde Compliance': 'hazardous_materials',
  'Contractor EHS': 'contractor_management',
  'Exposure Assessment': 'exposure_control',
  'Excavation and Trenching': 'excavation',
  'Safety System Override': 'system_override'
};

/**
 * Determine document category based on filename
 */
function getDocumentCategory(filename) {
  for (const [keyword, category] of Object.entries(DOCUMENT_CATEGORIES)) {
    if (filename.includes(keyword)) {
      return category;
    }
  }
  return 'general_safety';
}

/**
 * Upload a single document to the AI knowledge base
 */
async function uploadDocument(filePath, filename) {
  try {
    console.log(`📄 Processing: ${filename}`);
    
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = (fileBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`   Size: ${fileSize} MB`);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: getContentType(filename)
    });
    
    // Add metadata
    formData.append('category', getDocumentCategory(filename));
    formData.append('source', 'official_sml_documentation');
    formData.append('compliance_type', 'georgia_pacific_sml_2025');
    
    // Upload to backend
    console.log(`   📤 Uploading to AI knowledge base...`);
    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      body: formData,
      timeout: 120000 // 2 minute timeout for large files
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log(`   ✅ Success! Document ID: ${result.file_id}`);
    console.log(`   🧠 Indexed: ${result.indexed ? 'Yes' : 'No'}`);
    console.log(`   ⚡ Processing time: ${result.processing_time_ms}ms`);
    
    if (result.analysis) {
      console.log(`   🔍 Safety analysis: ${result.analysis.summary?.substring(0, 100)}...`);
    }
    
    console.log('');
    
    return result;
    
  } catch (error) {
    console.error(`   ❌ Failed to upload ${filename}: ${error.message}`);
    return null;
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc': return 'application/msword';
    case '.txt': return 'text/plain';
    default: return 'application/octet-stream';
  }
}

/**
 * Check if backend is running
 */
async function checkBackend() {
  try {
    console.log('🔍 Checking backend status...');
    const response = await fetch(`${BACKEND_URL}/health`);
    if (response.ok) {
      const health = await response.json();
      console.log(`✅ Backend healthy (${health.version})`);
      return true;
    }
  } catch (error) {
    console.error('❌ Backend not responding. Please ensure SMLGPT V2.0 backend is running on port 5000.');
    return false;
  }
}

/**
 * Main batch upload process
 */
async function batchUploadSMLDocuments() {
  console.log('🧠 SMLGPT V2.0 - Official SML Documentation Batch Upload');
  console.log('=' .repeat(60));
  console.log('📚 Building AI knowledge base with Georgia-Pacific SML standards...');
  console.log('');
  
  // Check backend
  const backendOk = await checkBackend();
  if (!backendOk) {
    process.exit(1);
  }
  
  // Get all SML documents
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
  const results = [];
  
  // Process each document
  for (let i = 0; i < smlDocs.length; i++) {
    const filename = smlDocs[i];
    const filePath = path.join(SML_DOCS_PATH, filename);
    
    console.log(`[${i + 1}/${smlDocs.length}] Processing SML document:`);
    
    const result = await uploadDocument(filePath, filename);
    
    if (result) {
      successful++;
      results.push(result);
    } else {
      failed++;
    }
    
    // Add delay between uploads to avoid overwhelming the system
    if (i < smlDocs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Final summary
  console.log('=' .repeat(60));
  console.log('🎉 SML Documentation Upload Complete!');
  console.log('');
  console.log(`📊 Summary:`);
  console.log(`   ✅ Successful uploads: ${successful}`);
  console.log(`   ❌ Failed uploads: ${failed}`);
  console.log(`   📚 Total documents in AI knowledge base: ${successful}`);
  console.log('');
  
  if (successful > 0) {
    console.log('🧠 Your AI now has comprehensive knowledge of:');
    console.log('   • Georgia-Pacific SML 2025 standards');
    console.log('   • All 10 work category controls');
    console.log('   • Critical hazard compliance procedures');
    console.log('   • Safety audit protocols');
    console.log('   • Training documentation');
    console.log('   • Emergency response procedures');
    console.log('');
    console.log('🎯 Ready for comprehensive safety analysis and compliance checking!');
  }
  
  if (failed > 0) {
    console.log(`⚠️  ${failed} documents failed to upload. Check the logs above for details.`);
  }
  
  console.log('');
  console.log('🚀 Test your AI knowledge base by asking safety questions in the frontend!');
}

// Run the batch upload
if (require.main === module) {
  batchUploadSMLDocuments().catch(console.error);
}

module.exports = { batchUploadSMLDocuments, uploadDocument };
