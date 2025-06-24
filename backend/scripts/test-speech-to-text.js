/**
 * Speech-to-Text Testing Script
 * 
 * This script tests the Azure Speech-to-Text functionality in multiple ways:
 * 1. Direct Azure Speech SDK integration test
 * 2. Backend API endpoint test using sample audio
 * 3. Format compatibility verification between frontend and backend
 * 
 * Usage: 
 * node test-speech-to-text.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason } = sdk;
const azureServices = require('../services/azureServices');

// Constants
const BACKEND_URL = 'http://localhost:5000'; // Change if your server runs on a different port
const ENHANCED_WAV_PATH = path.join(__dirname, 'enhanced-audio.wav'); // Enhanced WAV file path
const ENHANCED_MP3_PATH = path.join(__dirname, 'enhanced-audio.mp3'); // Enhanced MP3 file path
const SAMPLE_WAV_PATH = ENHANCED_WAV_PATH; // Use enhanced audio as our primary test file
const SAMPLE_MP3_PATH = ENHANCED_MP3_PATH; // Use enhanced audio as our primary test file

// Logger
const logger = {
  info: (message, data = {}) => {
    const dataStr = Object.keys(data).length > 0 ? 
      '\n' + JSON.stringify(data, null, 2) : '';
    console.log(`[INFO] ${message}${dataStr}`);
  },
  error: (message, error = {}) => {
    const errorStr = error instanceof Error ? 
      `\n${error.stack || error.message}` : 
      (Object.keys(error).length > 0 ? '\n' + JSON.stringify(error, null, 2) : '');
    console.error(`[ERROR] ${message}${errorStr}`);
  },
  success: (message) => console.log(`[SUCCESS] ✅ ${message}`),
  warning: (message) => console.log(`[WARNING] ⚠️ ${message}`),
  section: (title) => console.log(`\n${'='.repeat(50)}\n${title}\n${'='.repeat(50)}`),
  divider: () => console.log('-'.repeat(50))
};

/**
 * Test Azure Speech Services credentials directly
 */
async function testAzureSpeechCredentials() {
  logger.section('1. Testing Azure Speech Services Credentials');
  try {
    // Get credentials from env
    const azureSpeechKey = process.env.AZURE_SPEECH_KEY;
    const azureSpeechRegion = process.env.AZURE_SPEECH_REGION;
    
    if (!azureSpeechKey || !azureSpeechRegion) {
      logger.error('Azure Speech Services credentials not found in environment variables');
      return false;
    }
    
    logger.info('Creating Speech config with credentials');
    const speechConfig = SpeechConfig.fromSubscription(azureSpeechKey, azureSpeechRegion);
    speechConfig.speechRecognitionLanguage = 'en-US';
    
    // We're not actually going to recognize anything, just test if the config is valid
    logger.info('Testing speech configuration validity');
    // The mere creation of SpeechRecognizer will throw if credentials are invalid
    const recognizer = new SpeechRecognizer(speechConfig);
    recognizer.close();
    
    logger.success('Azure Speech Services credentials are valid');
    return true;
  } catch (error) {
    logger.error('Azure Speech Services credential test failed', error);
    return false;
  }
}

/**
 * Test backend initialization of Azure Speech Services
 */
async function testBackendAzureSpeechInitialization() {
  logger.section('2. Testing Backend Azure Speech Services Initialization');
  try {
    // Explicitly initialize services first
    logger.info('Initializing Azure services...');
    azureServices.initializeServices();
    
    // Wait for initialization to complete
    logger.info('Waiting for Azure services to be ready...');
    await azureServices.ensureServicesReady();
    
    // Test speech service connection
    const result = await azureServices.testSpeechConnection();
    
    if (result && result.success) {
      logger.success('Backend Azure Speech Services initialized successfully');
      logger.info('Connection details:', result);
      return true;
    } else {
      logger.error('Backend Azure Speech Services initialization failed', result);
      return false;
    }
  } catch (error) {
    logger.error('Backend Azure Speech Services initialization test failed', error);
    return false;
  }
}

/**
 * Check for enhanced audio files for testing
 */
async function ensureSampleAudioFiles() {
  logger.section('3. Ensuring Enhanced Audio Files Exist');
  
  // Check if enhanced files exist
  const wavExists = fs.existsSync(ENHANCED_WAV_PATH);
  const mp3Exists = fs.existsSync(ENHANCED_MP3_PATH);
  
  if (wavExists && mp3Exists) {
    // Get file sizes to verify they are proper audio files
    const wavStats = fs.statSync(ENHANCED_WAV_PATH);
    const mp3Stats = fs.existsSync(ENHANCED_MP3_PATH) ? fs.statSync(ENHANCED_MP3_PATH) : { size: 0 };
    
    logger.success('Enhanced audio files found');
    logger.info('WAV file details', { path: ENHANCED_WAV_PATH, size: wavStats.size + ' bytes' });
    logger.info('MP3 file details', { path: ENHANCED_MP3_PATH, size: mp3Stats.size + ' bytes' });
    
    return { wav: ENHANCED_WAV_PATH, mp3: ENHANCED_MP3_PATH };
  }
  
  logger.error('Enhanced audio files not found - please run enhanced-test-audio.js first');
  logger.info('You can generate proper test files by running: node scripts/enhanced-test-audio.js');
  
  // Check if old sample files exist as fallback
  const oldWavPath = path.join(__dirname, 'sample-audio.wav');
  const oldMp3Path = path.join(__dirname, 'sample-audio.mp3');
  
  if (fs.existsSync(oldWavPath) && fs.existsSync(oldMp3Path)) {
    logger.warning('Using old sample files as fallback - these may not work correctly');
    return { wav: oldWavPath, mp3: oldMp3Path };
  }
  
  throw new Error('No valid test audio files found. Please run enhanced-test-audio.js first.');
}

/**
 * Test direct Azure SDK speech recognition with local audio file
 */
async function testDirectSpeechRecognitionWithSDK(audioFilePath) {
  logger.section('4. Testing Direct Speech Recognition with Azure SDK');
  
  if (!fs.existsSync(audioFilePath)) {
    logger.error('Audio file not found:', { path: audioFilePath });
    return false;
  }
  
  // Check file size to verify it's not just a placeholder
  const fileStats = fs.statSync(audioFilePath);
  if (fileStats.size < 1000) {  // Less than 1KB is probably not a real audio file
    logger.warning('Audio file appears to be too small for testing. Please use a real audio file.');
    return false;
  }
  
  try {
    // Get credentials from env
    const azureSpeechKey = process.env.AZURE_SPEECH_KEY;
    const azureSpeechRegion = process.env.AZURE_SPEECH_REGION;
    
    if (!azureSpeechKey || !azureSpeechRegion) {
      logger.error('Azure Speech Services credentials not found in environment variables');
      return false;
    }
    
    return new Promise((resolve) => {
      logger.info('Initializing speech recognition with file', { path: audioFilePath });
      const speechConfig = SpeechConfig.fromSubscription(azureSpeechKey, azureSpeechRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';
      
      // Use push stream instead of direct file input (matching how the actual service works)
      const pushStream = sdk.AudioInputStream.createPushStream();
      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
      const recognizer = new SpeechRecognizer(speechConfig, audioConfig);
      
      // Push the WAV file data to the stream
      const fileBuffer = fs.readFileSync(audioFilePath);
      logger.info('Audio file loaded', { size: fileBuffer.length + ' bytes' });
      
      // Determine if this is a WAV file by checking for RIFF header
      const isWav = fileBuffer.length > 12 && 
                    fileBuffer.toString('ascii', 0, 4) === 'RIFF' && 
                    fileBuffer.toString('ascii', 8, 12) === 'WAVE';
      
      if (isWav) {
        // Get WAV header info for logging
        const numChannels = fileBuffer.readUInt16LE(22);
        const sampleRate = fileBuffer.readUInt32LE(24);
        const bitsPerSample = fileBuffer.readUInt16LE(34);
        
        logger.info('WAV file details', { 
          channels: numChannels, 
          sampleRate: sampleRate + ' Hz', 
          bitsPerSample: bitsPerSample + ' bits' 
        });
        
        // Skip the WAV header (usually 44 bytes) and push only the audio data
        // Look for the 'data' subchunk to find exact audio data start position
        let dataOffset = 12; // Start looking after RIFF header
        while (dataOffset < fileBuffer.length - 8) { // Need at least 8 bytes for chunk header
          const chunkId = fileBuffer.toString('ascii', dataOffset, dataOffset + 4);
          const chunkSize = fileBuffer.readUInt32LE(dataOffset + 4);
          
          if (chunkId === 'data') {
            // Found data chunk - the audio data starts right after this header
            dataOffset += 8; // Skip the 'data' identifier and size
            break;
          }
          
          dataOffset += 8 + chunkSize; // Move to next chunk
        }
        
        logger.info('Pushing WAV audio data to stream', { dataOffset, audioDataSize: fileBuffer.length - dataOffset + ' bytes' });
        pushStream.write(fileBuffer.slice(dataOffset));
      } else {
        // Not a WAV file or unknown format, try pushing the whole buffer
        logger.warning('File does not appear to be a valid WAV - pushing entire buffer');
        pushStream.write(fileBuffer);
      }
      
      pushStream.close();
      
      logger.info('Starting speech recognition...');
      
      recognizer.recognizeOnceAsync(
        (result) => {
          if (result.reason === ResultReason.RecognizedSpeech) {
            logger.success('Speech recognition succeeded');
            logger.info('Recognized text:', { text: result.text });
            recognizer.close();
            resolve(true);
          } else {
            logger.error('Speech recognition failed', { 
              reason: result.reason,
              errorDetails: result.errorDetails || 'No details available' 
            });
            recognizer.close();
            resolve(false);
          }
        },
        (error) => {
          logger.error('Speech recognition error', error);
          recognizer.close();
          resolve(false);
        }
      );
    });
  } catch (error) {
    logger.error('Error during direct speech recognition test', error);
    return false;
  }
}

/**
 * Test the backend API endpoint for speech recognition
 */
async function testBackendSpeechRecognitionEndpoint(audioFilePath) {
  logger.section('5. Testing Backend Speech Recognition API Endpoint');
  
  if (!fs.existsSync(audioFilePath)) {
    logger.error('Audio file not found:', { path: audioFilePath });
    return false;
  }
  
  try {
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioFilePath));
    
    logger.info('Sending audio file to backend API', { path: audioFilePath, endpoint: `${BACKEND_URL}/api/speech/recognize` });
    
    const response = await axios.post(`${BACKEND_URL}/api/speech/recognize`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    if (response.status === 200 && response.data && response.data.text) {
      logger.success('Backend API endpoint test succeeded');
      logger.info('Recognized text:', { text: response.data.text });
      return true;
    } else {
      logger.error('Backend API endpoint test failed', { 
        status: response.status, 
        data: response.data 
      });
      return false;
    }
  } catch (error) {
    logger.error('Error during backend API test', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return false;
  }
}

/**
 * Test format compatibility with different audio formats
 */
async function testFormatCompatibility(wavPath, mp3Path) {
  logger.section('6. Testing Audio Format Compatibility');
  
  const results = {
    wav: { sdk: false, api: false },
    mp3: { sdk: false, api: false }
  };
  
  // Test WAV format with SDK and API
  if (fs.existsSync(wavPath)) {
    logger.info('Testing WAV format compatibility');
    results.wav.sdk = await testDirectSpeechRecognitionWithSDK(wavPath);
    results.wav.api = await testBackendSpeechRecognitionEndpoint(wavPath);
  } else {
    logger.warning('WAV file not found, skipping WAV tests');
  }
  
  // Test MP3 format with SDK and API
  if (fs.existsSync(mp3Path)) {
    logger.info('Testing MP3 format compatibility');
    try {
      results.mp3.sdk = await testDirectSpeechRecognitionWithSDK(mp3Path);
    } catch (error) {
      logger.warning('MP3 format not supported by direct SDK method', { error: error.message });
      results.mp3.sdk = false;
    }
    
    try {
      results.mp3.api = await testBackendSpeechRecognitionEndpoint(mp3Path);
    } catch (error) {
      logger.warning('MP3 format not supported by API endpoint', { error: error.message });
      results.mp3.api = false;
    }
  } else {
    logger.warning('MP3 file not found, skipping MP3 tests');
  }
  
  // Log compatibility results
  logger.info('Audio format compatibility results:', results);
  
  // Check for format issues
  if (results.wav.sdk && !results.wav.api) {
    logger.warning('WAV format works with SDK but not with API endpoint - possible API implementation issue');
  }
  
  if (!results.mp3.sdk && results.mp3.api) {
    logger.warning('MP3 format works with API but not with SDK - this is unexpected and suggests custom processing');
  }
  
  return results;
}

/**
 * Check frontend audio capture format
 */
async function analyzeFrontendAudioFormat() {
  logger.section('7. Analyzing Frontend Audio Capture Format');
  
  // We can't directly test the frontend here, but we can provide guidance
  logger.info('Frontend Analysis:');
  logger.info('- Browser Web Speech API typically uses WAV format');
  logger.info('- Azure Speech SDK in browser typically uses WAV format');
  logger.info('- Check if frontend is converting audio to correct format before sending to backend');
  
  // Look at the actual code that sends audio to backend
  try {
    const frontendPath = path.join(__dirname, '../../frontend/src/hooks/useAzureSpeechRecognition.ts');
    if (fs.existsSync(frontendPath)) {
      const content = fs.readFileSync(frontendPath, 'utf8');
      
      // Check for relevant format conversion or handling code
      if (content.includes('AudioFormat') || content.includes('audio format') || 
          content.includes('wav') || content.includes('mp3')) {
        logger.info('Found potential audio format handling in frontend code');
        
        // Extract relevant code snippets - this is a simple approach
        const formatRelatedCode = content.split('\n')
          .filter(line => line.includes('format') || line.includes('AudioFormat'))
          .join('\n');
          
        if (formatRelatedCode) {
          logger.info('Relevant code from frontend:', formatRelatedCode);
        }
      } else {
        logger.warning('No explicit audio format handling found in frontend code - this could be an issue');
      }
    } else {
      logger.warning('Frontend code not found at expected path:', { path: frontendPath });
    }
  } catch (error) {
    logger.error('Error analyzing frontend code', error);
  }
  
  return {
    recommendation: 'Verify that frontend is sending audio in WAV format, which is required by the Azure Speech SDK'
  };
}

/**
 * Run the complete test suite
 */
async function runTests() {
  logger.section('Starting Speech-to-Text Testing Suite');
  
  // Step 1: Test Azure Speech Services credentials
  const credentialsValid = await testAzureSpeechCredentials();
  if (!credentialsValid) {
    logger.error('Azure Speech Services credential test failed - stopping tests');
    return;
  }
  
  // Step 2: Test backend Azure Speech Services initialization
  const backendInitialized = await testBackendAzureSpeechInitialization();
  if (!backendInitialized) {
    logger.error('Backend Azure Speech Services initialization test failed - stopping tests');
    return;
  }
  
  // Step 3: Ensure sample audio files exist
  const audioFiles = await ensureSampleAudioFiles();
  
  // Step 4: Test direct Azure SDK speech recognition
  await testDirectSpeechRecognitionWithSDK(audioFiles.wav);
  
  // Step 5: Test backend API endpoint
  await testBackendSpeechRecognitionEndpoint(audioFiles.wav);
  
  // Step 6: Test format compatibility
  await testFormatCompatibility(audioFiles.wav, audioFiles.mp3);
  
  // Step 7: Analyze frontend audio format
  await analyzeFrontendAudioFormat();
  
  logger.section('Speech-to-Text Testing Complete');
  logger.info('Next steps:');
  logger.info('1. Replace the placeholder audio files with real samples for accurate testing');
  logger.info('2. Check the format compatibility results for potential issues');
  logger.info('3. Verify that frontend is sending audio in the format expected by backend');
  logger.info('4. Review backend code to ensure proper audio format handling');
}

// Run all tests
runTests().catch(error => {
  logger.error('Fatal error running tests', error);
});
