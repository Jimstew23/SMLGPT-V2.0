const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

class SMLGPTE2ETester {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.testResults = [];
  }

  async init(headless = false) {
    console.log('🎭 Initializing Playwright browser...');
    
    this.browser = await chromium.launch({ 
      headless,
      slowMo: 500, // Slow down to see what's happening
      args: ['--no-sandbox', '--disable-dev-shm-usage'] // For better compatibility
    });
    
    this.context = await this.browser.newContext({
      recordVideo: {
        dir: './test-videos',
        size: { width: 1280, height: 720 }
      },
      recordHar: {
        path: `./test-results/network-${Date.now()}.har`
      },
      viewport: { width: 1280, height: 720 }
    });
    
    this.page = await this.context.newPage();
    
    // Setup network monitoring
    this.setupNetworkMonitoring();
    
    // Setup console monitoring
    this.page.on('console', msg => {
      console.log(`🌐 Console [${msg.type()}]: ${msg.text()}`);
    });
    
    // Setup error monitoring
    this.page.on('pageerror', error => {
      console.error(`💥 Page Error: ${error.message}`);
      this.testResults.push({
        type: 'page_error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  setupNetworkMonitoring() {
    // Monitor all network requests
    this.page.on('request', request => {
      const url = request.url();
      const method = request.method();
      
      if (url.includes('localhost:5000') || url.includes('localhost:3000')) {
        console.log(`📤 ${method} ${url}`);
        
        this.testResults.push({
          type: 'request',
          method,
          url,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    this.page.on('response', response => {
      const url = response.url();
      const status = response.status();
      
      if (url.includes('localhost:5000') || url.includes('localhost:3000')) {
        const statusIcon = status >= 200 && status < 300 ? '✅' : 
                          status >= 400 ? '❌' : '⚠️';
        console.log(`📥 ${statusIcon} ${status} ${url}`);
        
        this.testResults.push({
          type: 'response',
          status,
          url,
          timestamp: new Date().toISOString()
        });
        
        if (status >= 400) {
          console.error(`❌ HTTP Error: ${status} ${url}`);
        }
      }
    });
    
    // Monitor failed requests
    this.page.on('requestfailed', request => {
      console.error(`💥 Request Failed: ${request.url()} - ${request.failure().errorText}`);
      this.testResults.push({
        type: 'request_failed',
        url: request.url(),
        error: request.failure().errorText,
        timestamp: new Date().toISOString()
      });
    });
  }

  async takeScreenshot(name, fullPage = true) {
    const filename = `test-results/screenshot-${name}-${Date.now()}.png`;
    await this.page.screenshot({ 
      path: filename,
      fullPage 
    });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filename;
  }

  async waitForElement(selector, timeout = 30000) {
    console.log(`⏳ Waiting for element: ${selector}`);
    try {
      await this.page.waitForSelector(selector, { timeout });
      console.log(`✅ Element found: ${selector}`);
      return true;
    } catch (error) {
      console.error(`❌ Element not found: ${selector} - ${error.message}`);
      await this.takeScreenshot(`missing-element-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);
      return false;
    }
  }

  async testFrontendLoad() {
    console.log('\n🌐 Testing Frontend Load...');
    
    try {
      // Navigate to app
      console.log('📍 Navigating to SMLGPT...');
      await this.page.goto('http://localhost:3000', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      await this.takeScreenshot('frontend-loaded');
      
      // Check basic elements
      const elements = [
        { selector: '.chat-container', name: 'Chat Container' },
        { selector: 'textarea', name: 'Input Textarea' },
        { selector: '.status-indicator', name: 'Status Indicator' }
      ];
      
      for (const element of elements) {
        const found = await this.waitForElement(element.selector, 5000);
        if (!found) {
          throw new Error(`Required element not found: ${element.name}`);
        }
      }
      
      console.log('✅ Frontend loaded successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Frontend load failed:', error.message);
      await this.takeScreenshot('frontend-load-failed');
      return false;
    }
  }

  async testBackendConnection() {
    console.log('\n🔌 Testing Backend Connection...');
    
    try {
      // Check connection status
      const statusFound = await this.waitForElement('.status-indicator.connected', 10000);
      
      if (statusFound) {
        console.log('✅ Backend connected');
        await this.takeScreenshot('backend-connected');
        return true;
      } else {
        // Check if disconnected status is shown
        const disconnectedFound = await this.page.locator('.status-indicator.disconnected').count();
        if (disconnectedFound > 0) {
          console.log('⚠️ Backend disconnected - this is expected if backend is not running');
          await this.takeScreenshot('backend-disconnected');
        }
        return false;
      }
      
    } catch (error) {
      console.error('❌ Backend connection test failed:', error.message);
      await this.takeScreenshot('backend-connection-failed');
      return false;
    }
  }

  async createTestImage() {
    const testImagePath = path.join(__dirname, 'test-safety-image.jpg');
    
    if (!fs.existsSync(testImagePath)) {
      console.log('📁 Creating test image...');
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
        
        console.log('✅ Test image created');
      } catch (error) {
        console.log('⚠️ Could not create test image with Sharp, creating placeholder');
        // Create a simple placeholder
        fs.writeFileSync(testImagePath + '.txt', 'Test safety image placeholder');
        return testImagePath + '.txt';
      }
    }
    
    return testImagePath;
  }

  async testFileUpload() {
    console.log('\n📁 Testing File Upload...');
    
    try {
      // Create test image
      const testImagePath = await this.createTestImage();
      
      // Find file input
      const fileInputFound = await this.waitForElement('input[type="file"]', 5000);
      if (!fileInputFound) {
        throw new Error('File input not found');
      }
      
      // Upload file
      console.log('📤 Uploading test file...');
      await this.page.setInputFiles('input[type="file"]', testImagePath);
      
      await this.takeScreenshot('file-uploaded');
      
      // Wait for upload completion (look for system message or attachment)
      console.log('⏳ Waiting for upload completion...');
      const uploadComplete = await Promise.race([
        this.page.waitForSelector('.system-message', { timeout: 30000 }).then(() => 'system-message'),
        this.page.waitForSelector('.attachment', { timeout: 30000 }).then(() => 'attachment'),
        this.page.waitForSelector('.upload-success', { timeout: 30000 }).then(() => 'upload-success')
      ]).catch(() => null);
      
      if (uploadComplete) {
        console.log(`✅ Upload completed (detected: ${uploadComplete})`);
        await this.takeScreenshot('upload-completed');
        return true;
      } else {
        console.log('⚠️ Upload completion not detected within timeout');
        await this.takeScreenshot('upload-timeout');
        return false;
      }
      
    } catch (error) {
      console.error('❌ File upload failed:', error.message);
      await this.takeScreenshot('upload-failed');
      return false;
    }
  }

  async testChatInteraction() {
    console.log('\n💬 Testing Chat Interaction...');
    
    try {
      // Find textarea
      const textareaFound = await this.waitForElement('textarea', 5000);
      if (!textareaFound) {
        throw new Error('Textarea not found');
      }
      
      // Type message
      const message = 'Analyze this image for safety hazards and provide recommendations';
      console.log('💭 Typing chat message...');
      await this.page.fill('textarea', message);
      
      await this.takeScreenshot('message-typed');
      
      // Send message (Enter key)
      console.log('📨 Sending message...');
      await this.page.press('textarea', 'Enter');
      
      await this.takeScreenshot('message-sent');
      
      // Wait for response
      console.log('⏳ Waiting for AI response...');
      const responseReceived = await Promise.race([
        this.page.waitForSelector('.message.assistant:last-child', { timeout: 60000 }).then(() => 'assistant-message'),
        this.page.waitForSelector('.ai-response', { timeout: 60000 }).then(() => 'ai-response'),
        this.page.waitForSelector('.error-message', { timeout: 60000 }).then(() => 'error-message')
      ]).catch(() => null);
      
      if (responseReceived === 'error-message') {
        console.log('⚠️ Error message received');
        await this.takeScreenshot('chat-error');
        return false;
      } else if (responseReceived) {
        console.log(`✅ AI response received (type: ${responseReceived})`);
        await this.takeScreenshot('chat-success');
        return true;
      } else {
        console.log('⚠️ No response received within timeout');
        await this.takeScreenshot('chat-timeout');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Chat interaction failed:', error.message);
      await this.takeScreenshot('chat-failed');
      return false;
    }
  }

  async runCompleteE2ETest() {
    console.log('\n🎯 Running Complete E2E Test Suite');
    console.log('='.repeat(50));
    
    const results = {
      frontendLoad: false,
      backendConnection: false,
      fileUpload: false,
      chatInteraction: false,
      startTime: new Date().toISOString(),
      endTime: null,
      errors: [],
      screenshots: []
    };
    
    try {
      await this.init(false); // Run with visible browser
      
      // Test 1: Frontend Load
      results.frontendLoad = await this.testFrontendLoad();
      
      // Test 2: Backend Connection
      results.backendConnection = await this.testBackendConnection();
      
      // Test 3: File Upload (only if backend connected)
      if (results.backendConnection) {
        results.fileUpload = await this.testFileUpload();
        
        // Test 4: Chat Interaction (only if upload worked)
        if (results.fileUpload) {
          results.chatInteraction = await this.testChatInteraction();
        }
      } else {
        console.log('⏭️ Skipping file upload and chat tests (backend not connected)');
      }
      
      // Final screenshot
      await this.takeScreenshot('final-state');
      
    } catch (error) {
      console.error('💥 E2E test suite failed:', error.message);
      results.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    } finally {
      results.endTime = new Date().toISOString();
      results.testResults = this.testResults;
      
      // Save test report
      const reportPath = path.join(__dirname, '..', 'test-results', `e2e-report-${Date.now()}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
      
      await this.cleanup();
      
      // Print summary
      this.printTestSummary(results);
      
      return results;
    }
  }

  printTestSummary(results) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 E2E TEST SUMMARY');
    console.log('='.repeat(50));
    
    const tests = [
      { name: 'Frontend Load', result: results.frontendLoad },
      { name: 'Backend Connection', result: results.backendConnection },
      { name: 'File Upload', result: results.fileUpload },
      { name: 'Chat Interaction', result: results.chatInteraction }
    ];
    
    tests.forEach(test => {
      const icon = test.result ? '✅' : '❌';
      console.log(`${icon} ${test.name}: ${test.result ? 'PASS' : 'FAIL'}`);
    });
    
    const passCount = tests.filter(t => t.result).length;
    const totalTests = tests.length;
    
    console.log('\n📈 Overall Result:');
    console.log(`   ${passCount}/${totalTests} tests passed (${Math.round(passCount/totalTests*100)}%)`);
    
    if (results.errors.length > 0) {
      console.log(`\n🚨 ${results.errors.length} errors occurred during testing`);
    }
    
    console.log(`\n📁 Test artifacts saved in:`);
    console.log(`   Screenshots: ./test-results/`);
    console.log(`   Videos: ./test-videos/`);
    console.log(`   Network logs: ./test-results/`);
    
    console.log('='.repeat(50));
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up browser resources...');
    
    if (this.context) {
      await this.context.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    console.log('✅ Cleanup completed');
  }
}

// Quick test methods for individual components
class QuickTests {
  static async testFrontendOnly() {
    const tester = new SMLGPTE2ETester();
    await tester.init(false);
    
    try {
      const result = await tester.testFrontendLoad();
      await tester.takeScreenshot('quick-frontend-test');
      return result;
    } finally {
      await tester.cleanup();
    }
  }
  
  static async testBackendAPI() {
    // Direct API test without browser
    const axios = require('axios');
    
    try {
      console.log('🔍 Testing backend API directly...');
      const response = await axios.get('http://localhost:5000/api/health', {
        timeout: 5000
      });
      
      console.log(`✅ Backend API accessible: ${response.status}`);
      return response.status === 200;
    } catch (error) {
      console.log(`❌ Backend API not accessible: ${error.message}`);
      return false;
    }
  }
}

// Run the test if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const testType = args[0] || 'full';
  
  switch (testType) {
    case 'frontend':
      QuickTests.testFrontendOnly().catch(console.error);
      break;
    case 'backend':
      QuickTests.testBackendAPI().catch(console.error);
      break;
    case 'full':
    default:
      const tester = new SMLGPTE2ETester();
      tester.runCompleteE2ETest().catch(console.error);
      break;
  }
}

module.exports = { SMLGPTE2ETester, QuickTests };
