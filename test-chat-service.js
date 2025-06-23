// Test our backend chatService.processChat() directly
require('dotenv').config();
const ChatService = require('./backend/services/chatService');

async function testChatService() {
  console.log('🚀 TESTING BACKEND CHAT SERVICE INTEGRATION...');
  
  try {
    const chatService = new ChatService();
    console.log('✅ ChatService instance created');
    
    // Test with simple message
    console.log('\n🎯 TESTING CHAT PROCESSING...');
    const result = await chatService.processChat({
      message: "Hello! Please respond to confirm you're working.",
      conversation_id: "test-123",
      include_search: false // Disable search to isolate GPT-4.1 issue
    });
    
    console.log('\n🎉 CHAT SERVICE SUCCESS!');
    console.log('✅ Response:', result.response);
    console.log('✅ Model Used:', result.model_used);
    console.log('✅ Processing Time:', result.processing_time_ms + 'ms');
    console.log('✅ Safety Flags:', result.safety_flags);
    
  } catch (error) {
    console.error('\n🚨 CHAT SERVICE ERROR:');
    console.error('❌ Error Message:', error.message);
    console.error('❌ Error Stack:', error.stack);
    console.error('❌ Error Code:', error.code);
    console.error('❌ Full Error:', error);
  }
}

testChatService();
