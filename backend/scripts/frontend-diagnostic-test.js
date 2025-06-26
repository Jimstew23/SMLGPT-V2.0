const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class FrontendDiagnosticTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.results = {
            ui_interactions: {},
            upload_tests: {},
            speech_tests: {},
            button_states: {},
            handshakes: {},
            console_errors: []
        };
    }

    async initialize() {
        console.log('🔍 Starting Frontend Diagnostic Test...');
        
        this.browser = await puppeteer.launch({
            headless: false, // Show browser for debugging
            devtools: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        
        // Capture console messages
        this.page.on('console', msg => {
            const text = msg.text();
            console.log(`📱 CONSOLE [${msg.type()}]:`, text);
            this.results.console_errors.push({
                type: msg.type(),
                text: text,
                timestamp: new Date().toISOString()
            });
        });
        
        // Capture network requests
        this.page.on('request', request => {
            console.log(`🌐 REQUEST: ${request.method()} ${request.url()}`);
        });
        
        this.page.on('response', response => {
            console.log(`📡 RESPONSE: ${response.status()} ${response.url()}`);
        });
        
        await this.page.goto('http://localhost:3000', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        console.log('✅ Frontend loaded successfully');
    }

    async testUIInteractions() {
        console.log('\n🎯 Testing UI Interactions...');
        
        try {
            // Test if main components are loaded
            const components = {
                chatInput: 'input[placeholder*="message"]',
                sendButton: 'button[type="submit"]',
                fileInput: 'input[type="file"]',
                microphoneButton: '[data-testid="microphone-button"], button[aria-label*="microphone"], button[title*="microphone"]'
            };
            
            for (const [name, selector] of Object.entries(components)) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    console.log(`✅ ${name} found`);
                    this.results.ui_interactions[name] = 'found';
                } catch (error) {
                    console.log(`❌ ${name} NOT found`);
                    this.results.ui_interactions[name] = 'missing';
                }
            }
            
            // Test button interactions
            const sendButton = await this.page.$('button[type="submit"]');
            if (sendButton) {
                // Check initial state
                const initialDisabled = await sendButton.evaluate(el => el.disabled);
                console.log(`📝 Send button initially disabled: ${initialDisabled}`);
                
                // Type in input and check if button enables
                await this.page.type('input[placeholder*="message"]', 'Test message');
                await this.page.waitForTimeout(1000);
                
                const afterTypingDisabled = await sendButton.evaluate(el => el.disabled);
                console.log(`📝 Send button after typing disabled: ${afterTypingDisabled}`);
                
                this.results.button_states.send_button = {
                    initially_disabled: initialDisabled,
                    after_typing_disabled: afterTypingDisabled,
                    responds_to_input: initialDisabled !== afterTypingDisabled
                };
            }
            
        } catch (error) {
            console.error('❌ UI Interaction test failed:', error.message);
            this.results.ui_interactions.error = error.message;
        }
    }

    async testFileUpload() {
        console.log('\n📁 Testing File Upload...');
        
        try {
            // Create a test image file
            const testImagePath = path.join(__dirname, 'test-image.png');
            if (!fs.existsSync(testImagePath)) {
                // Create a small test image (1x1 PNG)
                const pngBuffer = Buffer.from([
                    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
                    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
                    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x57, 0x63, 0xF8, 0x0F, 0x00, 0x00,
                    0x01, 0x00, 0x01, 0x5C, 0xCC, 0x5E, 0x11, 0x00, 0x00, 0x00, 0x00, 0x49,
                    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
                ]);
                fs.writeFileSync(testImagePath, pngBuffer);
            }
            
            // Find file input
            const fileInput = await this.page.$('input[type="file"]');
            if (!fileInput) {
                console.log('❌ File input not found');
                this.results.upload_tests.file_input = 'missing';
                return;
            }
            
            console.log('📎 File input found, testing upload...');
            
            // Monitor network activity during upload
            let uploadStarted = false;
            let uploadCompleted = false;
            let uploadError = null;
            
            this.page.on('request', (request) => {
                if (request.url().includes('/api/upload')) {
                    uploadStarted = true;
                    console.log('🚀 Upload request started');
                }
            });
            
            this.page.on('response', (response) => {
                if (response.url().includes('/api/upload')) {
                    uploadCompleted = true;
                    console.log(`📦 Upload response: ${response.status()}`);
                }
            });
            
            // Upload file
            await fileInput.uploadFile(testImagePath);
            console.log('📤 File selected for upload');
            
            // Wait for upload to process
            await this.page.waitForTimeout(5000);
            
            // Check for upload progress indicators
            const uploadProgress = await this.page.$('.upload-progress, .progress-bar, .spinner, .loading');
            const uploadStatus = uploadProgress ? 'progress_indicator_found' : 'no_progress_indicator';
            
            this.results.upload_tests = {
                file_input_found: true,
                upload_started: uploadStarted,
                upload_completed: uploadCompleted,
                progress_indicator: uploadStatus,
                error: uploadError
            };
            
            console.log(`📊 Upload test results:`, this.results.upload_tests);
    
        } catch (error) {
            console.error('❌ File upload test failed:', error.message);
            this.results.upload_tests.error = error.message;
        }
    }

    async testSpeechFunctionality() {
        console.log('\n🎤 Testing Speech Functionality...');
        
        try {
            // Look for microphone button with various selectors
            const micSelectors = [
                '[data-testid="microphone-button"]',
                'button[aria-label*="microphone"]',
                'button[title*="microphone"]',
                'button[aria-label*="record"]',
                'button[title*="record"]',
                '.microphone-button',
                '.mic-button'
            ];
            
            let micButton = null;
            for (const selector of micSelectors) {
                try {
                    micButton = await this.page.$(selector);
                    if (micButton) {
                        console.log(`🎙️ Microphone button found with selector: ${selector}`);
                        break;
                    }
                } catch (e) {}
            }
            
            if (!micButton) {
                console.log('❌ No microphone button found');
                this.results.speech_tests.microphone_button = 'missing';
                return;
            }
            
            // Test microphone button state
            const initialState = await micButton.evaluate(el => ({
                disabled: el.disabled,
                className: el.className,
                ariaLabel: el.getAttribute('aria-label'),
                title: el.title
            }));
            
            console.log('🎤 Initial microphone button state:', initialState);
            
            // Try clicking microphone button
            await micButton.click();
            console.log('🎤 Microphone button clicked');
            
            await this.page.waitForTimeout(2000);
            
            // Check state after click
            const afterClickState = await micButton.evaluate(el => ({
                disabled: el.disabled,
                className: el.className,
                ariaLabel: el.getAttribute('aria-label'),
                title: el.title
            }));
            
            console.log('🎤 Microphone button state after click:', afterClickState);
            
            // Check for recording indicators
            const recordingIndicators = await this.page.$$('.recording, .listening, .speech-active, .mic-active');
            
            this.results.speech_tests = {
                microphone_button_found: true,
                initial_state: initialState,
                after_click_state: afterClickState,
                state_changed: JSON.stringify(initialState) !== JSON.stringify(afterClickState),
                recording_indicators: recordingIndicators.length,
                clickable: !initialState.disabled
            };
            
            console.log(`🎙️ Speech test results:`, this.results.speech_tests);
            
        } catch (error) {
            console.error('❌ Speech functionality test failed:', error.message);
            this.results.speech_tests.error = error.message;
        }
    }

    async testHandshakes() {
        console.log('\n🤝 Testing API Handshakes...');
        
        try {
            // Test health endpoint
            const healthResponse = await this.page.evaluate(async () => {
                try {
                    const response = await fetch('http://localhost:5000/api/health');
                    return {
                        status: response.status,
                        ok: response.ok,
                        data: await response.json()
                    };
                } catch (error) {
                    return { error: error.message };
                }
            });
            
            console.log('🏥 Health check result:', healthResponse);
            this.results.handshakes.health = healthResponse;
            
            // Test chat endpoint
            const chatResponse = await this.page.evaluate(async () => {
                try {
                    const response = await fetch('http://localhost:5000/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: 'Test handshake',
                            conversation_history: [],
                            include_context: false
                        })
                    });
                    return {
                        status: response.status,
                        ok: response.ok,
                        data: await response.text()
                    };
                } catch (error) {
                    return { error: error.message };
                }
            });
            
            console.log('💬 Chat handshake result:', chatResponse);
            this.results.handshakes.chat = chatResponse;
            
        } catch (error) {
            console.error('❌ Handshake test failed:', error.message);
            this.results.handshakes.error = error.message;
        }
    }

    async generateReport() {
        console.log('\n📊 Generating Diagnostic Report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                ui_components_found: Object.values(this.results.ui_interactions).filter(v => v === 'found').length,
                upload_functional: this.results.upload_tests.upload_started === true,
                speech_functional: this.results.speech_tests.state_changed === true,
                api_responsive: this.results.handshakes.health?.ok === true
            },
            detailed_results: this.results,
            recommendations: []
        };
        
        // Generate recommendations
        if (report.summary.ui_components_found < 3) {
            report.recommendations.push('UI components missing - check component rendering');
        }
        
        if (!report.summary.upload_functional) {
            report.recommendations.push('File upload not working - check FormData and backend endpoint');
        }
        
        if (!report.summary.speech_functional) {
            report.recommendations.push('Speech functionality not working - check microphone permissions and state management');
        }
        
        if (!report.summary.api_responsive) {
            report.recommendations.push('Backend API not responding - check server status');
        }
        
        if (this.results.console_errors.filter(e => e.type === 'error').length > 0) {
            report.recommendations.push('Console errors present - check browser console for details');
        }
        
        // Save report
        const reportPath = path.join(__dirname, 'frontend-diagnostic-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('\n📋 DIAGNOSTIC SUMMARY:');
        console.log(`UI Components Found: ${report.summary.ui_components_found}/4`);
        console.log(`Upload Functional: ${report.summary.upload_functional}`);
        console.log(`Speech Functional: ${report.summary.speech_functional}`);
        console.log(`API Responsive: ${report.summary.api_responsive}`);
        console.log(`\n💡 Recommendations:`);
        report.recommendations.forEach(rec => console.log(`  - ${rec}`));
        console.log(`\n📄 Full report saved to: ${reportPath}`);
        
        return report;
    }

    async run() {
        try {
            await this.initialize();
            await this.testUIInteractions();
            await this.testFileUpload();
            await this.testSpeechFunctionality();
            await this.testHandshakes();
            const report = await this.generateReport();
            
            return report;
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// Run the test if called directly
if (require.main === module) {
    const test = new FrontendDiagnosticTest();
    test.run()
        .then(report => {
            console.log('\n🎉 Frontend diagnostic test completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Frontend diagnostic test failed:', error.message);
            process.exit(1);
        });
}

module.exports = FrontendDiagnosticTest;
