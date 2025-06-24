/**
 * Create speech-compatible WAV test file for Azure Speech Services testing
 * This script creates a WAV file that follows strict WAV format requirements
 * for Azure Speech SDK compatibility
 */

const fs = require('fs');
const path = require('path');

// Create a fully compliant WAV file for speech recognition testing
function createCompatibleTestWav(outputPath) {
  // WAV format parameters
  const sampleRate = 16000;    // 16kHz - Standard for speech recognition
  const bitsPerSample = 16;    // 16-bit PCM
  const numChannels = 1;       // Mono
  const durationSec = 3;       // 3 seconds
  
  // Calculate derived parameters
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * numChannels * bytesPerSample;
  const fileSize = 44 + dataSize; // 44 bytes for RIFF WAV header
  
  // Create buffer for the entire WAV file
  const buffer = Buffer.alloc(fileSize);
  
  // Write RIFF WAV header
  // RIFF header
  buffer.write('RIFF', 0);                          // ChunkID
  buffer.writeUInt32LE(fileSize - 8, 4);           // ChunkSize
  buffer.write('WAVE', 8);                          // Format
  
  // fmt subchunk
  buffer.write('fmt ', 12);                         // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                     // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);                      // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);            // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);             // SampleRate
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);          // BitsPerSample
  
  // data subchunk
  buffer.write('data', 36);                         // Subchunk2ID
  buffer.writeUInt32LE(dataSize, 40);               // Subchunk2Size
  
  // Generate audio data - creating a signal that approximates speech frequencies (300Hz-3kHz)
  console.log('Generating audio data...');
  for (let i = 0; i < numSamples; i++) {
    // Create a composite waveform with frequencies in speech range
    // Base tone at ~500Hz with harmonics to create a voice-like sound
    const t = i / sampleRate;
    
    // Fundamental tone + harmonics + some amplitude modulation to simulate speech rhythm
    const fundamental = 0.3 * Math.sin(2 * Math.PI * 500 * t);
    const harmonic1 = 0.2 * Math.sin(2 * Math.PI * 1000 * t);
    const harmonic2 = 0.1 * Math.sin(2 * Math.PI * 1500 * t);
    const harmonic3 = 0.05 * Math.sin(2 * Math.PI * 2000 * t);
    
    // Amplitude modulation to simulate speech patterns
    const envelope = 0.8 + 0.2 * Math.sin(2 * Math.PI * 3 * t);
    
    // Combine waveforms
    const sample = envelope * (fundamental + harmonic1 + harmonic2 + harmonic3);
    
    // Scale to 16-bit range and convert to int16
    const scaledSample = Math.floor(sample * 32767);
    
    // Write to buffer as 16-bit LE value
    buffer.writeInt16LE(scaledSample, 44 + i * bytesPerSample);
  }
  
  // Write the WAV file
  fs.writeFileSync(outputPath, buffer);
  const stats = fs.statSync(outputPath);
  console.log(`Created compatible WAV test file at ${outputPath}`);
  console.log(`File size: ${stats.size} bytes`);
  
  return outputPath;
}

// Create a dummy MP3 file that's better formatted
function createImprovedMp3Dummy(outputPath) {
  // MP3 frame header constants
  const MPEG1_Layer3 = 0xFB; // MPEG Version 1, Layer 3
  const Bitrate_128k = 0x90; // 128kbps
  const SampleRate_44k = 0x00; // 44.1kHz
  const ChannelMode_Joint = 0xC0; // Joint Stereo
  
  // A more complete MP3 header and some frames
  const buffer = Buffer.alloc(4096); // 4KB dummy MP3
  
  // First frame header
  buffer[0] = 0xFF;           // Sync word (part 1)
  buffer[1] = MPEG1_Layer3;   // Sync word (part 2) + MPEG Version + Layer
  buffer[2] = Bitrate_128k | SampleRate_44k; // Bitrate + Sample rate
  buffer[3] = ChannelMode_Joint | 0x08; // Channel mode + padding bit
  
  // Second frame header (continue the pattern to make it seem more legitimate)
  buffer[1024] = 0xFF;
  buffer[1025] = MPEG1_Layer3;
  buffer[1026] = Bitrate_128k | SampleRate_44k;
  buffer[1027] = ChannelMode_Joint | 0x08;
  
  // Third frame header
  buffer[2048] = 0xFF;
  buffer[2049] = MPEG1_Layer3;
  buffer[2050] = Bitrate_128k | SampleRate_44k;
  buffer[2051] = ChannelMode_Joint | 0x08;
  
  // Write ID3 tag at the end
  const id3Offset = 3072;
  buffer.write('TAG', id3Offset);
  buffer.write('Test MP3 for Azure', id3Offset + 3); // Title
  buffer.write('Speech SDK Test', id3Offset + 33);   // Artist
  buffer.write('Test Album', id3Offset + 63);        // Album
  
  // Write to file
  fs.writeFileSync(outputPath, buffer);
  const stats = fs.statSync(outputPath);
  console.log(`Created improved dummy MP3 file at ${outputPath}`);
  console.log(`File size: ${stats.size} bytes`);
  
  return outputPath;
}

// Output paths
const wavPath = path.join(__dirname, 'enhanced-audio.wav');
const mp3Path = path.join(__dirname, 'enhanced-audio.mp3');

// Create test files
createCompatibleTestWav(wavPath);
createImprovedMp3Dummy(mp3Path);

console.log('Enhanced test audio files created successfully.');
