// Real debugging - check if environment variables are actually loaded
console.log('🚨 DEBUGGING ENVIRONMENT VARIABLE LOADING');
console.log('='.repeat(80));

// Check if dotenv is loaded
console.log('\n📋 STEP 1: Check dotenv loading');
require('dotenv').config();

// List ALL environment variables that start with OPENAI or AZURE
console.log('\n📋 STEP 2: Environment variables starting with OPENAI or AZURE:');
const envVars = Object.keys(process.env).filter(key => 
  key.startsWith('OPENAI') || key.startsWith('AZURE')
);

envVars.forEach(key => {
  const value = process.env[key];
  console.log(`   ${key} = ${value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : 'UNDEFINED'}`);
});

// Specifically check the problematic variables
console.log('\n📋 STEP 3: Specific variable checks:');
console.log(`   OPENAI_API_VERSION = ${process.env.OPENAI_API_VERSION || 'UNDEFINED'}`);
console.log(`   AZURE_OPENAI_API_VERSION = ${process.env.AZURE_OPENAI_API_VERSION || 'UNDEFINED'}`);
console.log(`   AZURE_OPENAI_ENDPOINT = ${process.env.AZURE_OPENAI_ENDPOINT || 'UNDEFINED'}`);
console.log(`   AZURE_OPENAI_API_KEY = ${process.env.AZURE_OPENAI_API_KEY ? '[REDACTED]' : 'UNDEFINED'}`);

// Check if .env file exists and is readable
const fs = require('fs');
const path = require('path');

console.log('\n📋 STEP 4: Check .env file:');
const envPath = path.join(__dirname, '.env');
try {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log(`   ✅ .env file exists (${envContent.length} characters)`);
    
    // Check if OPENAI_API_VERSION is in the file
    if (envContent.includes('OPENAI_API_VERSION')) {
      console.log(`   ✅ OPENAI_API_VERSION found in .env file`);
      
      // Extract the line
      const lines = envContent.split('\n');
      const openaiLines = lines.filter(line => line.includes('OPENAI_API_VERSION'));
      openaiLines.forEach(line => {
        console.log(`   📄 Line: ${line.trim()}`);
      });
    } else {
      console.log(`   ❌ OPENAI_API_VERSION NOT found in .env file`);
    }
  } else {
    console.log(`   ❌ .env file does not exist at: ${envPath}`);
  }
} catch (error) {
  console.log(`   ❌ Error reading .env file: ${error.message}`);
}

// Test OpenAI client creation
console.log('\n📋 STEP 5: Test OpenAI client creation:');
try {
  const { AzureOpenAI } = require('openai');
  
  console.log('   📋 Attempting to create AzureOpenAI client...');
  const client = new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.OPENAI_API_VERSION || process.env.AZURE_OPENAI_API_VERSION,
  });
  
  console.log('   ✅ AzureOpenAI client created successfully!');
  
} catch (error) {
  console.log(`   ❌ Failed to create AzureOpenAI client: ${error.message}`);
  console.log(`   ❌ Stack trace: ${error.stack}`);
}

console.log('\n🎯 ENVIRONMENT DEBUGGING COMPLETE');
console.log('='.repeat(80));
