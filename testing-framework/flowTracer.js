const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

class SMGPTFlowTracer {
  constructor() {
    this.steps = [];
    this.errors = [];
    this.apiCalls = [];
    this.startTime = Date.now();
  }

  log(step, status, details = {}) {
    const timestamp = Date.now() - this.startTime;
    const entry = {
      step,
      status,
      timestamp,
      details,
      time: new Date().toISOString()
    };
    
    this.steps.push(entry);
    
    // Color-coded console output
    const statusColor = status === 'success' ? chalk.green : 
                       status === 'error' ? chalk.red : 
                       status === 'warning' ? chalk.yellow : 
                       chalk.blue;
    
    // Safely extract message with proper null checking
    let detailsMessage = '';
    if (details) {
      if (typeof details === 'string') {
        detailsMessage = details;
      } else if (typeof details === 'object' && details.message) {
        detailsMessage = details.message;
      }
    }
    
    console.log(
      chalk.gray(`[${timestamp}ms]`),
      statusColor(`[${status.toUpperCase()}]`),
      chalk.white(step),
      detailsMessage ? chalk.gray(`- ${detailsMessage}`) : ''
    );
  }

  async traceAPICall(method, url, data, headers = {}) {
    const callId = Date.now();
    const startTime = Date.now();
    
    this.log(`API Call: ${method} ${url}`, 'info', { callId });
    
    try {
      const response = await axios({
        method,
        url,
        data,
        headers,
        validateStatus: () => true // Don't throw on any status
      });
      
      const duration = Date.now() - startTime;
      
      this.apiCalls.push({
        callId,
        method,
        url,
        status: response.status,
        duration,
        requestSize: JSON.stringify(data || {}).length,
        responseSize: JSON.stringify(response.data).length,
        headers: response.headers
      });
      
      if (response.status >= 200 && response.status < 300) {
        this.log(`API Response: ${response.status}`, 'success', {
          callId,
          duration: `${duration}ms`,
          dataPreview: JSON.stringify(response.data).substring(0, 100)
        });
      } else {
        this.log(`API Error: ${response.status}`, 'error', {
          callId,
          duration: `${duration}ms`,
          error: response.data
        });
        this.errors.push({
          step: `API ${method} ${url}`,
          error: response.data,
          status: response.status
        });
      }
      
      return response;
    } catch (error) {
      this.log(`API Exception: ${error.message}`, 'error', {
        callId,
        error: error.message,
        stack: error.stack
      });
      this.errors.push({
        step: `API ${method} ${url}`,
        error: error.message,
        type: 'exception'
      });
      throw error;
    }
  }

  generateReport() {
    console.log('\n' + chalk.bold.cyan('═══════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                 SMLGPT FLOW TRACE REPORT               '));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════\n'));
    
    // Summary
    const successCount = this.steps.filter(s => s.status === 'success').length;
    const errorCount = this.steps.filter(s => s.status === 'error').length;
    const totalDuration = Date.now() - this.startTime;
    
    console.log(chalk.bold('Summary:'));
    console.log(`  Total Steps: ${this.steps.length}`);
    console.log(`  ${chalk.green('✓ Success:')} ${successCount}`);
    console.log(`  ${chalk.red('✗ Errors:')} ${errorCount}`);
    console.log(`  Total Duration: ${totalDuration}ms\n`);
    
    // API Calls Table
    if (this.apiCalls.length > 0) {
      console.log(chalk.bold('API Calls:'));
      const apiTable = new Table({
        head: ['Method', 'URL', 'Status', 'Duration', 'Size'],
        colWidths: [8, 40, 8, 10, 15]
      });
      
      this.apiCalls.forEach(call => {
        apiTable.push([
          call.method,
          call.url.substring(0, 38),
          call.status,
          `${call.duration}ms`,
          `↑${call.requestSize}B ↓${call.responseSize}B`
        ]);
      });
      
      console.log(apiTable.toString());
    }
    
    // Errors
    if (this.errors.length > 0) {
      console.log('\n' + chalk.bold.red('Errors Detected:'));
      this.errors.forEach((err, idx) => {
        console.log(chalk.red(`\n${idx + 1}. ${err.step}`));
        console.log(chalk.gray(JSON.stringify(err.error, null, 2)));
      });
    }
    
    // Save detailed report
    const reportPath = path.join(__dirname, `trace-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        totalSteps: this.steps.length,
        successCount,
        errorCount,
        totalDuration,
        timestamp: new Date().toISOString()
      },
      steps: this.steps,
      apiCalls: this.apiCalls,
      errors: this.errors
    }, null, 2));
    
    console.log(`\n${chalk.gray('Detailed report saved to:')} ${reportPath}`);
  }
}

// Test Scenarios
class SMGPTTestScenarios {
  constructor(baseURL = 'http://localhost:5000') {
    this.baseURL = baseURL;
    this.tracer = new SMGPTFlowTracer();
  }

  async testHealthCheck() {
    this.tracer.log('Testing Health Check', 'start');
    try {
      const response = await this.tracer.traceAPICall(
        'GET',
        `${this.baseURL}/api/health`,
        null
      );
      
      if (response.data.status === 'healthy') {
        this.tracer.log('Backend is healthy', 'success');
        return true;
      }
      return false;
    } catch (error) {
      this.tracer.log('Health check failed', 'error', { error: error.message });
      return false;
    }
  }

  async testImageUpload(imagePath) {
    this.tracer.log('Testing Image Upload', 'start', { file: imagePath });
    
    try {
      // Step 1: Read file
      this.tracer.log('Reading image file', 'info');
      const imageBuffer = fs.readFileSync(imagePath);
      const stats = fs.statSync(imagePath);
      
      this.tracer.log('Image loaded', 'success', {
        size: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
        type: path.extname(imagePath)
      });
      
      // Step 2: Create form data
      this.tracer.log('Creating form data', 'info');
      const form = new FormData();
      form.append('file', imageBuffer, {
        filename: path.basename(imagePath),
        contentType: 'image/jpeg'
      });
      
      // Step 3: Upload
      this.tracer.log('Uploading to backend', 'info');
      const response = await this.tracer.traceAPICall(
        'POST',
        `${this.baseURL}/api/upload`,
        form,
        form.getHeaders()
      );
      
      if (response.status === 200) {
        this.tracer.log('Upload successful', 'success', {
          fileId: response.data.file_id,
          blobUrl: response.data.blob_url,
          processingTime: response.data.processing_time_ms
        });
        return response.data;
      } else {
        this.tracer.log('Upload failed', 'error', {
          status: response.status,
          error: response.data
        });
        return null;
      }
      
    } catch (error) {
      this.tracer.log('Upload exception', 'error', { error: error.message });
      return null;
    }
  }

  async testChatWithImage(message, documentReferences = []) {
    this.tracer.log('Testing Chat with Image Reference', 'start');
    
    try {
      const chatData = {
        message,
        conversation_history: [],
        include_context: true,
        document_references: documentReferences
      };
      
      this.tracer.log('Sending chat message', 'info', {
        hasReferences: documentReferences.length > 0
      });
      
      const response = await this.tracer.traceAPICall(
        'POST',
        `${this.baseURL}/api/chat`,
        chatData,
        { 'Content-Type': 'application/json' }
      );
      
      if (response.status === 200) {
        this.tracer.log('Chat response received', 'success', {
          responseLength: response.data.response.length,
          processingTime: response.data.processing_time_ms
        });
        return response.data;
      }
      
      return null;
    } catch (error) {
      this.tracer.log('Chat failed', 'error', { error: error.message });
      return null;
    }
  }

  async createTestImage() {
    const testImagePath = path.join(__dirname, 'test-safety-image.jpg');
    
    if (!fs.existsSync(testImagePath)) {
      this.tracer.log('Creating test image', 'info');
      try {
        const sharp = require('sharp');
        await sharp({
          create: {
            width: 800,
            height: 600,
            channels: 3,
            background: { r: 255, g: 165, b: 0 } // Orange safety color
          }
        })
        .jpeg()
        .toFile(testImagePath);
        
        this.tracer.log('Test image created', 'success', { path: testImagePath });
      } catch (error) {
        this.tracer.log('Could not create test image - using placeholder', 'warning');
        // Create a simple text file as placeholder
        fs.writeFileSync(testImagePath + '.txt', 'Test safety image placeholder');
        return testImagePath + '.txt';
      }
    }
    
    return testImagePath;
  }

  async runFullScenario() {
    console.log(chalk.bold.blue('\n🚀 Starting SMLGPT Full Flow Test\n'));
    
    // 1. Health Check
    const isHealthy = await this.testHealthCheck();
    if (!isHealthy) {
      this.tracer.log('Backend not running!', 'error');
      this.tracer.generateReport();
      return;
    }
    
    // 2. Create and upload test image
    const testImagePath = await this.createTestImage();
    const uploadResult = await this.testImageUpload(testImagePath);
    if (!uploadResult) {
      this.tracer.log('Upload failed - stopping test', 'error');
      this.tracer.generateReport();
      return;
    }
    
    // 3. Test chat with uploaded image
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing
    
    const chatResult = await this.testChatWithImage(
      'Analyze this image for safety hazards',
      [uploadResult.file_id]
    );
    
    if (chatResult) {
      this.tracer.log('Full scenario completed successfully!', 'success');
    } else {
      this.tracer.log('Chat analysis failed', 'error');
    }
    
    // Generate final report
    this.tracer.generateReport();
  }
}

// Run the test
if (require.main === module) {
  const tester = new SMGPTTestScenarios();
  tester.runFullScenario().catch(console.error);
}

module.exports = { SMGPTFlowTracer, SMGPTTestScenarios };
