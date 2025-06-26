#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_RESULTS_FILE = path.join(__dirname, 'speech-test-results.txt');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class SpeechTester {
  constructor() {
    this.results = [];
    this.testStartTime = Date.now();
  }

  log(message, color = 'reset') {
    const timestamp = new Date().toISOString();
    const coloredMessage = `${colors[color]}${message}${colors.reset}`;
    console.log(coloredMessage);
    
    // Also log to results
    this.results.push(`[${timestamp}] ${message}`);
  }

  async checkApiHealth() {
    try {
      this.log('\n🏥 Checking API health...', 'blue');
      const response = await axios.get(`${BASE_URL}/health`);
      
      if (response.status === 200) {
        this.log(`✅ API Status: ${response.data.status}`, 'green');
        return true;
      } else {
        this.log(`❌ API health check failed: ${response.status}`, 'red');
        return false;
      }
    } catch (error) {
      this.log(`❌ API health check failed: ${error.message}`, 'red');
      return false;
    }
  }

  async testTextToSpeech() {
    this.log('\n🔊 Testing Text-to-Speech...', 'cyan');
    this.log('==================================================', 'cyan');

    const testCases = [
      {
        name: 'Basic Safety Alert',
        text: 'STOP! Safety hazard detected. Please wear your safety equipment.',
        voice: 'en-US-AriaNeural'
      },
      {
        name: 'Technical Instructions',
        text: 'Please follow lockout tagout procedures before proceeding with maintenance.',
        voice: 'en-US-JennyNeural'
      },
      {
        name: 'Emergency Alert',
        text: 'Emergency evacuation required. Proceed to nearest exit immediately.',
        voice: 'en-US-GuyNeural'
      }
    ];

    for (const testCase of testCases) {
      try {
        this.log(`\n📋 Test Case: ${testCase.name}`, 'yellow');
        this.log(`Text: "${testCase.text}"`, 'reset');
        this.log(`Voice: ${testCase.voice}`, 'reset');
        this.log('--------------------------------------------------', 'yellow');

        const startTime = Date.now();

        const response = await axios.post(`${BASE_URL}/api/speech/synthesize`, {
          text: testCase.text,
          voice: testCase.voice
        }, {
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        const processingTime = Date.now() - startTime;

        if (response.status === 200) {
          const audioBuffer = Buffer.from(response.data);
          const audioFilePath = path.join(__dirname, `test-audio-${testCase.name.replace(/\s+/g, '-').toLowerCase()}.wav`);
          
          // Save audio file for verification
          fs.writeFileSync(audioFilePath, audioBuffer);

          this.log(`✅ Text-to-Speech completed in ${processingTime}ms`, 'green');
          this.log(`📁 Audio saved: ${audioFilePath}`, 'green');
          this.log(`📊 Audio size: ${audioBuffer.length} bytes`, 'reset');
          
          // Verify audio file
          const stats = fs.statSync(audioFilePath);
          if (stats.size > 1000) { // Should be at least 1KB for valid audio
            this.log(`✅ Audio file appears valid (${stats.size} bytes)`, 'green');
          } else {
            this.log(`⚠️  Audio file seems small (${stats.size} bytes)`, 'yellow');
          }

        } else {
          this.log(`❌ Text-to-Speech failed: HTTP ${response.status}`, 'red');
        }

      } catch (error) {
        this.log(`❌ Text-to-Speech error: ${error.message}`, 'red');
        if (error.response) {
          this.log(`Response status: ${error.response.status}`, 'red');
          this.log(`Response data: ${JSON.stringify(error.response.data)}`, 'red');
        }
      }
    }
  }

  async testSpeechToText() {
    this.log('\n🎙️ Testing Speech-to-Text...', 'cyan');
    this.log('==================================================', 'cyan');

    // First, create a test audio file using text-to-speech
    try {
      this.log('\n📤 Creating test audio file...', 'blue');
      const testText = 'This is a test of speech recognition functionality for safety compliance.';
      
      const ttsResponse = await axios.post(`${BASE_URL}/api/speech/synthesize`, {
        text: testText,
        voice: 'en-US-AriaNeural'
      }, {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (ttsResponse.status === 200) {
        const testAudioPath = path.join(__dirname, 'test-speech-recognition.wav');
        fs.writeFileSync(testAudioPath, Buffer.from(ttsResponse.data));
        this.log(`✅ Test audio created: ${testAudioPath}`, 'green');

        // Now test speech-to-text with the created audio
        this.log('\n🎯 Testing Speech Recognition...', 'blue');
        
        const formData = new FormData();
        formData.append('audio', fs.createReadStream(testAudioPath));

        const startTime = Date.now();

        const sttResponse = await axios.post(`${BASE_URL}/api/speech/recognize`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 30000
        });

        const processingTime = Date.now() - startTime;

        if (sttResponse.status === 200) {
          this.log(`✅ Speech-to-Text completed in ${processingTime}ms`, 'green');
          this.log(`📝 Original text: "${testText}"`, 'reset');
          this.log(`🎯 Recognized text: "${sttResponse.data.text}"`, 'green');
          
          // Calculate similarity
          const similarity = this.calculateSimilarity(testText.toLowerCase(), sttResponse.data.text.toLowerCase());
          this.log(`📊 Accuracy: ${(similarity * 100).toFixed(1)}%`, similarity > 0.8 ? 'green' : 'yellow');

        } else {
          this.log(`❌ Speech-to-Text failed: HTTP ${sttResponse.status}`, 'red');
        }

      } else {
        this.log(`❌ Could not create test audio file`, 'red');
      }

    } catch (error) {
      this.log(`❌ Speech-to-Text test error: ${error.message}`, 'red');
      if (error.response) {
        this.log(`Response status: ${error.response.status}`, 'red');
        this.log(`Response data: ${JSON.stringify(error.response.data)}`, 'red');
      }
    }
  }

  async testVoiceSelection() {
    this.log('\n🎭 Testing Voice Selection...', 'cyan');
    this.log('==================================================', 'cyan');

    const voices = [
      'en-US-AriaNeural',
      'en-US-JennyNeural', 
      'en-US-GuyNeural',
      'en-US-AnaNeural',
      'en-US-ChristopherNeural',
      'en-US-ElizabethNeural'
    ];

    const testText = 'Testing voice selection for safety alerts.';

    for (const voice of voices) {
      try {
        this.log(`\n🎤 Testing voice: ${voice}`, 'yellow');
        
        const startTime = Date.now();
        
        const response = await axios.post(`${BASE_URL}/api/speech/synthesize`, {
          text: testText,
          voice: voice
        }, {
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        const processingTime = Date.now() - startTime;

        if (response.status === 200) {
          const audioBuffer = Buffer.from(response.data);
          this.log(`✅ Voice ${voice}: ${processingTime}ms, ${audioBuffer.length} bytes`, 'green');
        } else {
          this.log(`❌ Voice ${voice}: HTTP ${response.status}`, 'red');
        }

      } catch (error) {
        this.log(`❌ Voice ${voice}: ${error.message}`, 'red');
      }
    }
  }

  async testSpeechEndpoints() {
    this.log('\n🔍 Testing Speech API Endpoints...', 'cyan');
    this.log('==================================================', 'cyan');

    const endpoints = [
      { path: '/api/speech/synthesize', method: 'POST', name: 'Text-to-Speech' },
      { path: '/api/speech/recognize', method: 'POST', name: 'Speech-to-Text' }
    ];

    for (const endpoint of endpoints) {
      try {
        this.log(`\n📡 Testing ${endpoint.name} endpoint...`, 'blue');
        
        // Test with invalid data to check error handling
        const response = await axios.post(`${BASE_URL}${endpoint.path}`, {}, {
          validateStatus: () => true // Accept all status codes
        });

        this.log(`📊 ${endpoint.name}: HTTP ${response.status}`, 
                 response.status < 500 ? 'green' : 'red');
        
        if (response.data) {
          this.log(`📄 Response: ${JSON.stringify(response.data).substring(0, 200)}...`, 'reset');
        }

      } catch (error) {
        this.log(`❌ ${endpoint.name} endpoint error: ${error.message}`, 'red');
      }
    }
  }

  calculateSimilarity(str1, str2) {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  async saveResults() {
    const summary = `
SMLGPT V2.0 Speech Functionality Test Results
============================================
Test Date: ${new Date().toISOString()}
Total Test Duration: ${Date.now() - this.testStartTime}ms

${this.results.join('\n')}

============================================
Test Summary Complete
`;

    fs.writeFileSync(TEST_RESULTS_FILE, summary);
    this.log(`\n📄 Test results saved to: ${TEST_RESULTS_FILE}`, 'green');
  }

  async runAllTests() {
    this.log('🎤 SMLGPT V2.0 Speech Functionality Test Suite', 'bright');
    this.log('================================================', 'bright');

    // Check API health first
    const isHealthy = await this.checkApiHealth();
    if (!isHealthy) {
      this.log('❌ API is not healthy. Aborting tests.', 'red');
      return;
    }

    // Run all speech tests
    await this.testSpeechEndpoints();
    await this.testTextToSpeech();
    await this.testSpeechToText();
    await this.testVoiceSelection();

    // Save results
    await this.saveResults();

    this.log('\n✅ Speech functionality test suite completed!', 'green');
  }
}

// Run tests if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const tester = new SpeechTester();

  if (args.includes('tts')) {
    tester.testTextToSpeech();
  } else if (args.includes('stt')) {
    tester.testSpeechToText();
  } else if (args.includes('voices')) {
    tester.testVoiceSelection();
  } else if (args.includes('endpoints')) {
    tester.testSpeechEndpoints();
  } else {
    tester.runAllTests();
  }
}

module.exports = SpeechTester;
