require('dotenv').config();
const { SearchIndexClient, AzureKeyCredential } = require('@azure/search-documents');
const fs = require('fs');

async function redeployAzureSearchIndex() {
  try {
    console.log('🔍 Starting Azure Search index redeployment...');
    
    // Load the correct schema from search-index-schema.json
    const schemaPath = '../search-index-schema.json';
    console.log('📄 Loading schema from:', schemaPath);
    
    const schemaData = fs.readFileSync(schemaPath, 'utf8');
    const indexSchema = JSON.parse(schemaData);
    
    console.log('✅ Schema loaded successfully');
    console.log('Index name:', indexSchema.name);
    console.log('Field count:', indexSchema.fields.length);
    
    // Validate schema structure
    console.log('🔍 Validating schema structure...');
    if (!indexSchema.fields || !Array.isArray(indexSchema.fields)) {
      throw new Error('Invalid schema: fields array is missing or invalid');
    }
    
    // Create index client
    const indexClient = new SearchIndexClient(
      process.env.AZURE_SEARCH_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_SEARCH_ADMIN_KEY)
    );
    
    console.log('🔗 Connected to Azure Search service');
    
    // Check if index exists
    const indexName = indexSchema.name;
    console.log(`🔍 Checking if index '${indexName}' exists...`);
    
    try {
      const existingIndex = await indexClient.getIndex(indexName);
      console.log('⚠️  Index exists - will delete first');
      
      // Delete existing index to ensure clean deployment
      console.log('🗑️  Deleting existing index...');
      await indexClient.deleteIndex(indexName);
      console.log('✅ Existing index deleted');
      
      // Wait a moment for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      if (error.statusCode === 404) {
        console.log('ℹ️  Index does not exist - will create new');
      } else {
        console.log('⚠️  Error checking index (will proceed):', error.message);
      }
    }
    
    // Create new index with correct schema
    console.log('🚀 Creating new index with correct schema...');
    console.log('Schema being deployed:', JSON.stringify(indexSchema, null, 2));
    
    try {
      const newIndex = await indexClient.createIndex(indexSchema);
      
      console.log('🎉 SUCCESS! Azure Search index redeployed successfully');
      console.log('Index name:', newIndex.name);
      
      // List all retrievable fields
      const retrievableFields = indexSchema.fields
        .filter(field => field.retrievable)
        .map(field => field.name);
      
      console.log('✅ Retrievable fields:', retrievableFields.join(', '));
      
    } catch (createError) {
      console.log('❌ Index creation failed:', createError.message);
      console.log('Full error:', createError);
      
      // Try a simplified index creation as fallback
      console.log('🔄 Attempting simplified index creation...');
      
      const simplifiedSchema = {
        name: indexSchema.name,
        fields: [
          {
            name: "id",
            type: "Edm.String",
            key: true,
            filterable: true,
            retrievable: true
          },
          {
            name: "title",
            type: "Edm.String",
            searchable: true,
            filterable: true,
            retrievable: true
          },
          {
            name: "content",
            type: "Edm.String",
            searchable: true,
            retrievable: true
          },
          {
            name: "file_type",
            type: "Edm.String",
            filterable: true,
            retrievable: true
          },
          {
            name: "url",
            type: "Edm.String",
            filterable: true,
            retrievable: true
          }
        ]
      };
      
      const fallbackIndex = await indexClient.createIndex(simplifiedSchema);
      console.log('✅ Simplified index created successfully');
      console.log('Index name:', fallbackIndex.name);
    }
    
    console.log('\n🔧 Next steps:');
    console.log('1. Restart the backend server');
    console.log('2. Test the chat endpoint');
    console.log('3. Verify all field errors are resolved');
    
  } catch (error) {
    console.log('❌ Azure Search index redeployment failed:', error.message);
    console.log('Error details:', error.details || 'No additional details');
    
    if (error.statusCode) {
      console.log('Status code:', error.statusCode);
    }
    
    console.log('Full error object:', error);
  }
}

console.log('Starting Azure Search index redeployment script...');
redeployAzureSearchIndex();
