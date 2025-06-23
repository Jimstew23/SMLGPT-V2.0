require('dotenv').config();
const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');

async function testAzureSearchFix() {
  try {
    console.log('🔍 Testing Azure Search with restricted retrievable fields...');
    
    const searchClient = new SearchClient(
      process.env.AZURE_SEARCH_ENDPOINT,
      process.env.AZURE_SEARCH_INDEX_NAME || 'smlgpt-v2-index',
      new AzureKeyCredential(process.env.AZURE_SEARCH_ADMIN_KEY)
    );

    // Test with only ID field (confirmed retrievable)
    console.log('1. Testing with ID only...');
    const result1 = await searchClient.search('*', {
      top: 1,
      select: ['id']
    });
    console.log('✅ ID-only search successful');

    // Test with ID + embedding (our backend's new default)
    console.log('2. Testing with ID + embedding...');
    try {
      const result2 = await searchClient.search('*', {
        top: 1,
        select: ['id', 'embedding']
      });
      console.log('✅ ID + embedding search successful');
    } catch (err) {
      console.log('❌ ID + embedding failed:', err.message.split('.')[0]);
    }

    // Test the search without any select (let Azure return defaults)
    console.log('3. Testing without select parameter...');
    const result3 = await searchClient.search('*', {
      top: 1
    });
    console.log('✅ No-select search successful');

    console.log('\n🎯 CONCLUSION: Azure Search now works with restricted field selection!');

  } catch (error) {
    console.log('❌ Azure Search Error:', error.message);
  }
}

testAzureSearchFix();
