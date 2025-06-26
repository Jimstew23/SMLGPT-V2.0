const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class APISimulationTest {
    constructor() {
        this.baseURL = 'http://localhost:5000';
        this.frontendURL = 'http://localhost:3000';
        this.results = {
            health_check: {},
            chat_endpoint: {},
            upload_endpoint: {},
            cors_test: {},
            timeout_test: {},
            error_patterns: [],
            recommendations: []
        };
    }

    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const colors = {
            info: '\x1b[36m',    // Cyan
            pass: '\x1b[32m',    // Green
            fail: '\x1b[31m',    // Red
            warn: '\x1b[33m',    // Yellow
            reset: '\x1b[0m'     // Reset
        };
        
        const color = colors[level] || colors.info;
        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    async testHealthEndpoint() {
        this.log('🏥 Testing Health Endpoint...', 'info');
        
        try {
            const startTime = Date.now();
            const response = await axios.get(`${this.baseURL}/api/health`, {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const responseTime = Date.now() - startTime;
            
            this.results.health_check = {
                status: response.status,
                ok: response.status === 200,
                response_time: responseTime,
                data: response.data
            };
            
            if (response.status === 200) {
                this.log(`✅ Health endpoint working - ${responseTime}ms`, 'pass');
                this.log(`   Status: ${response.data.status}`, 'info');
            } else {
                this.log(`❌ Health endpoint failed - Status: ${response.status}`, 'fail');
            }
            
        } catch (error) {
            this.log(`❌ Health endpoint error: ${error.message}`, 'fail');
            this.results.health_check = { error: error.message };
            
            if (error.code === 'ECONNREFUSED') {
                this.results.error_patterns.push('Backend server not running');
            }
        }
    }

    async testChatEndpoint() {
        this.log('💬 Testing Chat Endpoint...', 'info');
        
        try {
            const startTime = Date.now();
            const response = await axios.post(`${this.baseURL}/api/chat`, {
                message: 'Test message for diagnostic',
                conversation_history: [],
                include_context: false
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const responseTime = Date.now() - startTime;
            
            this.results.chat_endpoint = {
                status: response.status,
                ok: response.status === 200,
                response_time: responseTime,
                has_response: !!(response.data && response.data.response)
            };
            
            if (response.status === 200) {
                this.log(`✅ Chat endpoint working - ${responseTime}ms`, 'pass');
                if (response.data.response) {
                    this.log(`   Got response: ${response.data.response.substring(0, 50)}...`, 'info');
                }
            } else {
                this.log(`❌ Chat endpoint failed - Status: ${response.status}`, 'fail');
            }
            
        } catch (error) {
            this.log(`❌ Chat endpoint error: ${error.message}`, 'fail');
            this.results.chat_endpoint = { error: error.message };
            
            if (error.code === 'ENOTFOUND') {
                this.results.error_patterns.push('Azure Cognitive Search DNS resolution failed');
            }
            if (error.code === 'ECONNREFUSED') {
                this.results.error_patterns.push('Backend server not responding');
            }
        }
    }

    async testUploadEndpoint() {
        this.log('📁 Testing Upload Endpoint...', 'info');
        
        try {
            // Create a test image file
            const testImagePath = path.join(__dirname, 'test-upload.png');
            const testImageBuffer = Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
                0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
                0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x57, 0x63, 0xF8, 0x0F, 0x00, 0x00,
                0x01, 0x00, 0x01, 0x5C, 0xCC, 0x5E, 0x11, 0x00, 0x00, 0x00, 0x00, 0x49,
                0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
            ]);
            
            fs.writeFileSync(testImagePath, testImageBuffer);
            
            // Create FormData
            const formData = new FormData();
            formData.append('file', fs.createReadStream(testImagePath), {
                filename: 'test-upload.png',
                contentType: 'image/png'
            });
            
            const startTime = Date.now();
            const response = await axios.post(`${this.baseURL}/api/upload`, formData, {
                timeout: 35000, // 35 seconds to test timeout issue
                headers: {
                    ...formData.getHeaders(),
                    'Content-Type': 'multipart/form-data'
                }
            });
            const responseTime = Date.now() - startTime;
            
            this.results.upload_endpoint = {
                status: response.status,
                ok: response.status === 200,
                response_time: responseTime,
                timeout_issue: responseTime > 30000,
                data: response.data
            };
            
            if (response.status === 200) {
                this.log(`✅ Upload endpoint working - ${responseTime}ms`, 'pass');
                if (responseTime > 30000) {
                    this.log(`   ⚠️ Upload took over 30 seconds - may cause frontend timeouts`, 'warn');
                    this.results.error_patterns.push('Upload processing too slow (>30s)');
                }
            } else {
                this.log(`❌ Upload endpoint failed - Status: ${response.status}`, 'fail');
            }
            
            // Clean up test file
            fs.unlinkSync(testImagePath);
            
        } catch (error) {
            this.log(`❌ Upload endpoint error: ${error.message}`, 'fail');
            this.results.upload_endpoint = { error: error.message };
            
            if (error.code === 'ECONNABORTED') {
                this.results.error_patterns.push('Upload timeout - backend processing too slow');
            }
        }
    }

    async testCORSConfiguration() {
        this.log('🌐 Testing CORS Configuration...', 'info');
        
        try {
            // Test preflight request
            const response = await axios.options(`${this.baseURL}/api/chat`, {
                headers: {
                    'Origin': this.frontendURL,
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type'
                }
            });
            
            this.results.cors_test = {
                status: response.status,
                ok: response.status === 200 || response.status === 204,
                headers: response.headers
            };
            
            if (response.status === 200 || response.status === 204) {
                this.log(`✅ CORS preflight working`, 'pass');
            } else {
                this.log(`❌ CORS preflight failed - Status: ${response.status}`, 'fail');
                this.results.error_patterns.push('CORS configuration issue');
            }
            
        } catch (error) {
            this.log(`❌ CORS test error: ${error.message}`, 'fail');
            this.results.cors_test = { error: error.message };
        }
    }

    async testTimeoutScenarios() {
        this.log('⏱️ Testing Timeout Scenarios...', 'info');
        
        try {
            // Test with very short timeout to simulate frontend timeout
            const startTime = Date.now();
            
            try {
                await axios.post(`${this.baseURL}/api/chat`, {
                    message: 'Quick timeout test',
                    conversation_history: [],
                    include_context: true // This might trigger search which could be slow
                }, {
                    timeout: 2000 // 2 second timeout
                });
                
                this.log(`✅ Request completed within 2 seconds`, 'pass');
                
            } catch (timeoutError) {
                const responseTime = Date.now() - startTime;
                this.log(`⚠️ Request timed out after ${responseTime}ms`, 'warn');
                
                if (timeoutError.code === 'ECONNABORTED') {
                    this.results.error_patterns.push('Backend processing too slow for frontend timeout');
                }
            }
            
        } catch (error) {
            this.log(`❌ Timeout test error: ${error.message}`, 'fail');
        }
    }

    async simulateFrontendFlow() {
        this.log('🔄 Simulating Frontend Flow...', 'info');
        
        try {
            // 1. Health check (like frontend status check)
            await this.testHealthEndpoint();
            
            // 2. Chat request (like user sending message)
            await this.testChatEndpoint();
            
            // 3. File upload (like user uploading file)
            await this.testUploadEndpoint();
            
            // 4. CORS check (like frontend making cross-origin request)
            await this.testCORSConfiguration();
            
            // 5. Test timeout scenarios
            await this.testTimeoutScenarios();
            
        } catch (error) {
            this.log(`❌ Frontend flow simulation failed: ${error.message}`, 'fail');
        }
    }

    generateRecommendations() {
        this.log('💡 Generating Recommendations...', 'info');
        
        // Analyze results and generate recommendations
        if (this.results.health_check.error) {
            this.results.recommendations.push('🔴 CRITICAL: Backend server not running - start server first');
        }
        
        if (this.results.chat_endpoint.error) {
            if (this.results.chat_endpoint.error.includes('ENOTFOUND')) {
                this.results.recommendations.push('🔴 CRITICAL: Azure Cognitive Search DNS error - fix search endpoint');
            } else {
                this.results.recommendations.push('🔴 CRITICAL: Chat endpoint broken - check GPT-4.1 configuration');
            }
        }
        
        if (this.results.upload_endpoint.error) {
            if (this.results.upload_endpoint.error.includes('ECONNABORTED')) {
                this.results.recommendations.push('🔴 CRITICAL: Upload timeout - optimize backend processing');
            } else {
                this.results.recommendations.push('🔴 CRITICAL: Upload endpoint broken - check file handling');
            }
        }
        
        if (this.results.upload_endpoint.timeout_issue) {
            this.results.recommendations.push('⚠️ Upload processing too slow - will cause frontend timeouts');
        }
        
        if (this.results.cors_test.error) {
            this.results.recommendations.push('⚠️ CORS issues - may cause frontend request failures');
        }
        
        if (this.results.error_patterns.includes('Azure Cognitive Search DNS resolution failed')) {
            this.results.recommendations.push('🔧 Disable search temporarily or fix Azure Search endpoint');
        }
        
        if (this.results.error_patterns.includes('Upload processing too slow (>30s)')) {
            this.results.recommendations.push('🔧 Optimize Azure Vision processing or increase frontend timeout');
        }
        
        if (this.results.error_patterns.includes('Backend processing too slow for frontend timeout')) {
            this.results.recommendations.push('🔧 Optimize backend response time or increase frontend timeout');
        }
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                health_ok: this.results.health_check.ok,
                chat_ok: this.results.chat_endpoint.ok,
                upload_ok: this.results.upload_endpoint.ok,
                cors_ok: this.results.cors_test.ok,
                critical_issues: this.results.recommendations.filter(r => r.includes('CRITICAL')).length,
                warning_issues: this.results.recommendations.filter(r => r.includes('⚠️')).length
            },
            detailed_results: this.results,
            error_patterns: this.results.error_patterns,
            recommendations: this.results.recommendations
        };
        
        // Save report
        const reportPath = path.join(__dirname, 'api-simulation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Display summary
        this.log('\n📋 API SIMULATION SUMMARY:', 'info');
        this.log(`Health Endpoint: ${report.summary.health_ok ? '✅' : '❌'}`, report.summary.health_ok ? 'pass' : 'fail');
        this.log(`Chat Endpoint: ${report.summary.chat_ok ? '✅' : '❌'}`, report.summary.chat_ok ? 'pass' : 'fail');
        this.log(`Upload Endpoint: ${report.summary.upload_ok ? '✅' : '❌'}`, report.summary.upload_ok ? 'pass' : 'fail');
        this.log(`CORS Config: ${report.summary.cors_ok ? '✅' : '❌'}`, report.summary.cors_ok ? 'pass' : 'fail');
        
        this.log(`\n🔴 Critical Issues: ${report.summary.critical_issues}`, 'fail');
        this.log(`⚠️ Warning Issues: ${report.summary.warning_issues}`, 'warn');
        
        if (this.results.recommendations.length > 0) {
            this.log('\n💡 RECOMMENDATIONS:', 'info');
            this.results.recommendations.forEach(rec => {
                this.log(`  ${rec}`, 'warn');
            });
        }
        
        this.log(`\n📄 Full report saved to: ${reportPath}`, 'info');
        
        return report;
    }

    async run() {
        this.log('🚀 Starting API Simulation Test...', 'info');
        
        try {
            await this.simulateFrontendFlow();
            this.generateRecommendations();
            const report = await this.generateReport();
            
            return report;
        } catch (error) {
            this.log(`❌ Simulation test failed: ${error.message}`, 'fail');
            throw error;
        }
    }
}

// Run the test if called directly
if (require.main === module) {
    const test = new APISimulationTest();
    test.run()
        .then(report => {
            console.log('\n🎉 API simulation test completed!');
            
            // Exit with error code if critical issues found
            if (report.summary.critical_issues > 0) {
                console.log('❌ Critical issues found - check recommendations above');
                process.exit(1);
            } else {
                console.log('✅ No critical issues found');
                process.exit(0);
            }
        })
        .catch(error => {
            console.error('\n💥 API simulation test failed:', error.message);
            process.exit(1);
        });
}

module.exports = APISimulationTest;
