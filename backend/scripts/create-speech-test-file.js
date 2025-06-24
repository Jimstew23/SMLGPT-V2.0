/**
 * Create a test WAV file with speech synthesis for accurate speech recognition testing
 * This uses the built-in browser SpeechSynthesis API (via node-tts-api) to generate
 * a realistic speech WAV file for testing Azure Speech-to-Text.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Use PowerShell to generate speech using Windows built-in speech synthesis
async function createSpeechTestFile(outputPath, textToSpeak = "Testing speech to text functionality.") {
  console.log(`Creating speech test file with text: "${textToSpeak}"...`);
  
  // Get the absolute path to ensure PowerShell can find it
  const absolutePath = path.resolve(outputPath);
  console.log(`Absolute path: ${absolutePath}`);
  
  // Make sure the directory exists
  const dirPath = path.dirname(absolutePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // PowerShell command to generate speech WAV file using Windows Speech Synthesis
  const escapedPath = absolutePath.replace(/\\/g, '\\\\');
  
  const powershellCommand = `
    Add-Type -AssemblyName System.Speech
    $speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voices = $speech.GetInstalledVoices()
    $voice = $voices | Where-Object { $_.VoiceInfo.Name -like '*David*' -or $_.VoiceInfo.Name -like '*English*' } | Select-Object -First 1
    if ($voice) {
        $speech.SelectVoice($voice.VoiceInfo.Name)
        Write-Host "Using voice: " $voice.VoiceInfo.Name
    } else {
        Write-Host "No appropriate voice found, using default"
    }
    $speech.SetOutputToWaveFile('${escapedPath}')
    $speech.Rate = -2
    $speech.Speak('${textToSpeak}')
    $speech.Dispose()
    if (Test-Path '${escapedPath}') {
        Write-Host "File created successfully at ${escapedPath}"
        Get-Item '${escapedPath}' | Select-Object FullName, Length
    } else {
        Write-Host "Failed to create file at ${escapedPath}"
    }
  `;

  try {
    console.log("Executing PowerShell command...");
    const { stdout, stderr } = await execPromise(`powershell -ExecutionPolicy Bypass -Command "${powershellCommand}"`);
    console.log('PowerShell output:', stdout);
    if (stderr) {
      console.error('PowerShell error:', stderr);
    }

    // Wait briefly to ensure file operations are complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify file exists and has content
    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);
      console.log(`File exists at ${absolutePath} with size: ${stats.size} bytes`);
      return absolutePath;
    } else {
      throw new Error(`File was not created at ${absolutePath}`);
    }
  } catch (error) {
    console.error('Error creating speech test file:', error);
    throw error;
  }
}

// Generate test file path
const testFilePath = path.join(__dirname, 'real-speech-test.wav');

// Create the test file with speech synthesis
createSpeechTestFile(testFilePath)
  .then(() => {
    console.log('Speech test file created successfully');
  })
  .catch(err => {
    console.error('Failed to create speech test file:', err);
  });
