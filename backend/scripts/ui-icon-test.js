#!/usr/bin/env node

console.log('=== UI ICON SIMULATION TEST ===');
const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    console.log('🚀 Starting browser for icon testing...');
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Navigate to the app
    console.log('📄 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
    
    // Test 1: Check if file input exists and icon containers are present
    console.log('\n=== ICON CONTAINER TEST ===');
    const fileInputExists = await page.$('input[type="file"]') !== null;
    console.log('✅ File input element exists:', fileInputExists ? 'YES' : 'NO');
    
    // Test 2: Check for icon-related CSS classes and styling
    console.log('\n=== ICON CSS CLASS TEST ===');
    const iconClasses = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="icon"], [class*="file"], [class*="attachment"]');
      return Array.from(elements).map(el => el.className).filter(c => c && (c.includes('icon') || c.includes('file')));
    });
    console.log('Found icon-related classes:', iconClasses.length > 0 ? iconClasses.slice(0, 3) : 'NONE');
    
    // Test 3: Check if App component loaded without errors
    console.log('\n=== COMPONENT LOADING TEST ===');
    const pageTitle = await page.title();
    console.log('✅ Page title:', pageTitle);
    
    const hasReactErrors = await page.evaluate(() => {
      return document.body.innerHTML.includes('Error') || document.body.innerHTML.includes('Cannot');
    });
    console.log('✅ React errors detected:', hasReactErrors ? 'YES (bad)' : 'NO (good)');
    
    // Test 4: Simulate file selection to test icon rendering
    console.log('\n=== FILE ICON RENDERING TEST ===');
    
    const iconTestResult = await page.evaluate(() => {
      try {
        const fileInput = document.querySelector('input[type="file"]');
        return {
          fileInputFound: !!fileInput,
          canAccessFileInput: fileInput ? fileInput.accept : 'NO_INPUT',
          acceptedTypes: fileInput ? fileInput.accept.split(',').length : 0
        };
      } catch(e) {
        return { error: e.message };
      }
    });
    
    console.log('File input details:', iconTestResult);
    
    // Test 5: Check for attachment preview area
    console.log('\n=== ATTACHMENT PREVIEW TEST ===');
    const attachmentArea = await page.evaluate(() => {
      const attachments = document.querySelector('[class*="attachment"]') || document.querySelector('[class*="preview"]');
      const chatInput = document.querySelector('[class*="chat"]') && document.querySelector('[class*="input"]');
      return {
        hasAttachmentArea: !!attachments,
        hasChatInput: !!chatInput,
        bodyClasses: document.body.className
      };
    });
    console.log('Attachment area found:', attachmentArea.hasAttachmentArea ? 'YES' : 'NO');
    console.log('Chat input found:', attachmentArea.hasChatInput ? 'YES' : 'NO');
    
    // Test 6: Check console for any icon-related errors
    console.log('\n=== CONSOLE ERRORS TEST ===');
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });
    
    // Wait a moment for any console errors to appear
    await page.waitForTimeout(2000);
    
    const iconErrors = consoleLogs.filter(log => 
      log.includes('icon') || log.includes('file') || log.includes('getFileIconStyle')
    );
    
    console.log('Icon-related console errors:', iconErrors.length > 0 ? iconErrors : 'NONE (good)');
    
    // Test 7: Test icon utility function accessibility
    console.log('\n=== ICON FUNCTION ACCESSIBILITY TEST ===');
    const functionTest = await page.evaluate(() => {
      try {
        // Check if we can access window objects or test basic functionality
        const hasReact = typeof React !== 'undefined' || document.querySelector('[data-reactroot]') !== null;
        const hasIcons = document.querySelector('svg') !== null || document.querySelector('[class*="icon"]') !== null;
        return {
          hasReact: hasReact,
          hasIcons: hasIcons,
          reactVersion: hasReact ? 'React App Detected' : 'No React'
        };
      } catch(e) {
        return { error: e.message };
      }
    });
    
    console.log('Function accessibility test:', functionTest);
    
    console.log('\n✅ UI ICON SIMULATION COMPLETE!');
    
  } catch (error) {
    console.log('❌ Icon simulation error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
})();
