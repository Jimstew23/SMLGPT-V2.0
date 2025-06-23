// Direct GPT-4.1 test using our chatService approach
require('dotenv').config();
const { AzureOpenAI } = require('openai');
const logger = require('./utils/logger');

async function testChatDirect() {
  console.log('🎯 TESTING GPT-4.1 WITH OUR CHAT SERVICE APPROACH...');
  
  try {
    // Initialize Azure OpenAI client exactly like our chatService does
    const openaiClient = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    });
    
    console.log('✅ Azure OpenAI client initialized');
    console.log(`✅ Using endpoint: ${process.env.AZURE_OPENAI_ENDPOINT}`);
    console.log(`✅ Using deployment: ${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`);
    
    // Build messages exactly like our chatService does
    const systemInstructions = `You are SMLGPT V2.0, an AI-powered safety analysis and hybrid search system developed by Small. You specialize in analyzing safety scenarios using video, text, or uploaded images/documents.`;
    
    const messages = [
      {
        role: 'system',
        content: systemInstructions
      },
      {
        role: 'user',
        content: 'Hello! Please respond to confirm GPT-4.1 is working through our chat service integration.'
      }
    ];
    
    console.log('\n🚀 CALLING GPT-4.1 WITH OUR CHAT SERVICE CONFIGURATION...');
    
    // Call GPT-4.1 exactly like our chatService does
    const response = await openaiClient.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      messages,
      max_tokens: 2000,
      temperature: 0.1,
      top_p: 0.9
    });
    
    const aiResponse = response.choices[0].message.content;
    
    console.log('\n🎉 SUCCESS! GPT-4.1 RESPONSE RECEIVED:');
    console.log('✅ Response:', aiResponse);
    console.log('✅ Model:', response.model);
    console.log('✅ Usage:', response.usage);
    
    return {
      success: true,
      response: aiResponse,
      model: response.model,
      usage: response.usage
    };
    
  } catch (error) {
    console.error('\n🚨 GPT-4.1 INTEGRATION ERROR:');
    console.error('❌ Error Message:', error.message);
    console.error('❌ Error Code:', error.code);
    console.error('❌ Error Type:', error.type);
    console.error('❌ Full Error:', error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

testChatDirect();
