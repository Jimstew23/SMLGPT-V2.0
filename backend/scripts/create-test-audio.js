/**
 * Create simple test audio files for speech recognition testing
 * 
 * This creates simple tone-based WAV and MP3 files that can be used
 * for basic format testing with the Azure Speech Services.
 */

const fs = require('fs');
const path = require('path');

// Create a basic WAV file with a sine wave tone
function createTestWavFile(outputPath, durationSec = 2, frequency = 440) {
  const sampleRate = 16000; // 16kHz
  const bitsPerSample = 16;
  const numChannels = 1; // Mono
  const amplitude = 0.5;
  
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize); // 44 bytes for WAV header
  
  // Write WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4); // File size - 8
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Format chunk size
  buffer.writeUInt16LE(1, 20); // Audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // Byte rate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // Block align
  buffer.writeUInt16LE(bitsPerSample, 34); // Bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Write audio data - simple sine wave
  for (let i = 0; i < numSamples; i++) {
    const sampleValue = Math.floor(amplitude * 32767 * Math.sin(2 * Math.PI * frequency * i / sampleRate));
    buffer.writeInt16LE(sampleValue, 44 + i * 2);
  }
  
  // Write to file
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created test WAV file at ${outputPath}`);
  return outputPath;
}

// Since proper MP3 generation requires more complex libraries,
// we'll create a simple dummy MP3 file with basic MP3 frame headers
function createDummyMp3File(outputPath) {
  // This is NOT a valid MP3 file, just enough bytes with MP3 signature to trigger format detection
  const buffer = Buffer.from([
    0xFF, 0xFB, 0x90, 0x44, // MP3 frame header
    0x00, 0x00, 0x00, 0x00, // Some dummy data
    0x54, 0x41, 0x47, 0x30, // TAG marker
    // Fill with zeros for the rest
    ...Array(1024).fill(0)
  ]);
  
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created dummy MP3 file at ${outputPath} (not playable, for format testing only)`);
  return outputPath;
}

// Create test files
const wavPath = path.join(__dirname, 'sample-audio.wav');
const mp3Path = path.join(__dirname, 'sample-audio.mp3');

createTestWavFile(wavPath);
createDummyMp3File(mp3Path);

console.log('Test audio files created successfully.');
