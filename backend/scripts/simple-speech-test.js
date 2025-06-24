/**
 * Simplified Speech-to-Text Test Script
 * Tests Azure Speech SDK with our enhanced WAV file
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason, AudioInputStream } = sdk;

// Path to our enhanced WAV file
const ENHANCED_WAV_PATH = path.join(__dirname, 'enhanced-audio.wav');

console.log('\n======= Simplified Azure Speech SDK Test =======\n');

// Check if the enhanced WAV file exists
if (!fs.existsSync(ENHANCED_WAV_PATH)) {
  console.error(`Error: Enhanced WAV file not found at ${ENHANCED_WAV_PATH}`);
  console.log('Please run "node scripts/enhanced-test-audio.js" first');
  process.exit(1);
}

// Get file stats
const fileStats = fs.statSync(ENHANCED_WAV_PATH);
console.log(`Found enhanced WAV file: ${ENHANCED_WAV_PATH}`);
console.log(`File size: ${fileStats.size} bytes`);

// Load Azure Speech credentials from environment variables
const azureSpeechKey = process.env.AZURE_SPEECH_KEY;
const azureSpeechRegion = process.env.AZURE_SPEECH_REGION;

if (!azureSpeechKey || !azureSpeechRegion) {
  console.error('Error: Azure Speech credentials not found in environment variables');
  console.log('Make sure AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are set in .env file');
  process.exit(1);
}

console.log(`Using Azure Speech configuration:`);
console.log(`- Region: ${azureSpeechRegion}`);
console.log(`- Key: ${azureSpeechKey.substring(0, 5)}...`);

// Function to test speech recognition
async function testSpeechRecognition() {
  return new Promise((resolve, reject) => {
    try {
      console.log('\n--- Step 1: Creating Speech Configuration ---');
      const speechConfig = SpeechConfig.fromSubscription(azureSpeechKey, azureSpeechRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';
      
      console.log('\n--- Step 2: Reading WAV file ---');
      const audioBuffer = fs.readFileSync(ENHANCED_WAV_PATH);
      
      // Analyze WAV header
      if (audioBuffer.toString('ascii', 0, 4) === 'RIFF' && 
          audioBuffer.toString('ascii', 8, 12) === 'WAVE') {
        console.log('Valid WAV header found');
        
        const numChannels = audioBuffer.readUInt16LE(22);
        const sampleRate = audioBuffer.readUInt32LE(24);
        const bitsPerSample = audioBuffer.readUInt16LE(34);
        
        console.log(`WAV details:`);
        console.log(`- Channels: ${numChannels}`);
        console.log(`- Sample Rate: ${sampleRate} Hz`);
        console.log(`- Bits Per Sample: ${bitsPerSample} bits`);
      } else {
        console.warn('WARNING: File does not have a standard WAV header');
      }
      
      console.log('\n--- Step 3: Creating PushStream for audio data ---');
      const pushStream = AudioInputStream.createPushStream();
      const audioConfig = AudioConfig.fromStreamInput(pushStream);
      
      console.log('\n--- Step 4: Creating Speech Recognizer ---');
      const recognizer = new SpeechRecognizer(speechConfig, audioConfig);
      
      // Find the 'data' chunk in the WAV file
      const findDataChunk = (buffer) => {
        let offset = 12; // Start after RIFF header
        while (offset < buffer.length - 8) {
          const chunkId = buffer.toString('ascii', offset, offset + 4);
          const chunkSize = buffer.readUInt32LE(offset + 4);
          
          if (chunkId === 'data') {
            return { offset: offset + 8, size: chunkSize }; // Skip chunk header (8 bytes)
          }
          
          offset += 8 + chunkSize;
        }
        return { offset: 44, size: buffer.length - 44 }; // Default if not found
      };
      
      // Find the audio data in the WAV file
      const { offset, size } = findDataChunk(audioBuffer);
      console.log(`Audio data found at offset ${offset}, size ${size} bytes`);
      
      console.log('\n--- Step 5: Writing audio data to PushStream ---');
      pushStream.write(audioBuffer.slice(offset));
      pushStream.close();
      
      console.log('\n--- Step 6: Starting Speech Recognition ---');
      recognizer.recognizeOnceAsync(
        (result) => {
          console.log(`Recognition Result:`);
          console.log(`- Reason: ${result.reason}`);
          console.log(`- ResultId: ${result.resultId}`);
          
          if (result.reason === ResultReason.RecognizedSpeech) {
            console.log(`- Text: "${result.text}"`);
            console.log(`\nSUCCESS: Speech recognition completed successfully`);
            recognizer.close();
            resolve(result);
          } else {
            console.log(`- Error Details: ${result.errorDetails || 'No details available'}`);
            console.log(`\nWARNING: Speech not recognized. Reason code: ${result.reason}`);
            recognizer.close();
            resolve(result);
          }
        },
        (err) => {
          console.error(`\nERROR: Speech recognition failed:`, err);
          recognizer.close();
          reject(err);
        }
      );
      
      console.log('Waiting for recognition to complete...');
    } catch (error) {
      console.error('\nERROR: Exception during speech recognition setup:', error);
      reject(error);
    }
  });
}

// Run the test
testSpeechRecognition()
  .then(() => {
    console.log('\n======= Test Complete =======\n');
  })
  .catch((err) => {
    console.error('\nTest failed with error:', err);
    process.exit(1);
  });
