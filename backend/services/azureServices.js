const { BlobServiceClient } = require('@azure/storage-blob');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { CognitiveServicesCredentials } = require('@azure/ms-rest-azure-js');
const { DocumentAnalysisClient } = require('@azure/ai-form-recognizer');
const { SearchClient, SearchIndexClient } = require('@azure/search-documents');
const { AzureKeyCredential } = require('@azure/core-auth');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const logger = require('../utils/logger');

class AzureServices {
  constructor() {
    this.servicesReady = false;
    this.initializeServices();
  }

  async initializeServices() {
    try {
      // Initialize Blob Storage
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
      );
      this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

      // Initialize Computer Vision with DEDICATED endpoint
      this.visionClient = new ComputerVisionClient(
        new CognitiveServicesCredentials(process.env.AZURE_COMPUTER_VISION_KEY),
        process.env.AZURE_COMPUTER_VISION_ENDPOINT
      );

      // Initialize Document Intelligence with DEDICATED endpoint
      this.documentClient = new DocumentAnalysisClient(
        process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
        new AzureKeyCredential(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY)
      );

      // Initialize Search with DEDICATED endpoint
      this.searchClient = new SearchClient(
        process.env.AZURE_SEARCH_ENDPOINT,
        process.env.AZURE_SEARCH_INDEX_NAME,
        new AzureKeyCredential(process.env.AZURE_SEARCH_ADMIN_KEY)
      );

      this.searchIndexClient = new SearchIndexClient(
        process.env.AZURE_SEARCH_ENDPOINT,
        new AzureKeyCredential(process.env.AZURE_SEARCH_ADMIN_KEY)
      );

      // Initialize Speech Services with DEDICATED endpoint
      this.speechConfig = sdk.SpeechConfig.fromSubscription(
        process.env.AZURE_SPEECH_KEY,
        process.env.AZURE_SPEECH_REGION
      );

      this.servicesReady = true;
      logger.info('✅ All Azure services initialized with dedicated endpoints');
    } catch (error) {
      logger.error('Failed to initialize Azure services:', error);
      this.servicesReady = false;
    }
  }

  async ensureServicesReady() {
    if (!this.servicesReady) {
      throw new Error('Azure services not initialized');
    }
  }

  async uploadToBlob(fileName, buffer, mimeType) {
    await this.ensureServicesReady();
    
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      
      const uploadOptions = {
        blobHTTPHeaders: { blobContentType: mimeType }
      };
      
      await blockBlobClient.upload(buffer, buffer.length, uploadOptions);
      return blockBlobClient.url;
    } catch (error) {
      logger.error('Error uploading to blob:', error);
      throw error;
    }
  }

  async analyzeImage(imageUrl) {
    await this.ensureServicesReady();
    
    try {
      const features = ['Categories', 'Description', 'Objects', 'Tags'];
      const result = await this.visionClient.analyzeImage(imageUrl, { visualFeatures: features });
      return result;
    } catch (error) {
      logger.error('Error analyzing image:', error);
      throw error;
    }
  }

  async extractTextFromDocument(documentUrl) {
    await this.ensureServicesReady();
    
    try {
      const poller = await this.documentClient.beginAnalyzeDocumentFromUrl('prebuilt-read', documentUrl);
      const result = await poller.pollUntilDone();
      
      let extractedText = '';
      if (result.content) {
        extractedText = result.content;
      }
      
      return { text: extractedText, pages: result.pages };
    } catch (error) {
      logger.error('Error extracting text from document:', error);
      throw error;
    }
  }

  async searchDocuments(query, filters = {}) {
    await this.ensureServicesReady();
    
    try {
      const searchOptions = {
        searchText: query,
        filter: filters.filter,
        top: filters.top || 10,
        skip: filters.skip || 0
      };
      
      const searchResults = await this.searchClient.search(query, searchOptions);
      const results = [];
      
      for await (const result of searchResults.results) {
        results.push(result);
      }
      
      return results;
    } catch (error) {
      logger.error('Error searching documents:', error);
      throw error;
    }
  }

  async indexDocument(document) {
    await this.ensureServicesReady();
    
    try {
      const indexResult = await this.searchClient.uploadDocuments([document]);
      return indexResult;
    } catch (error) {
      logger.error('Error indexing document:', error);
      throw error;
    }
  }

  getSpeechConfig() {
    if (!this.servicesReady) {
      throw new Error('Azure services not initialized');
    }
    return this.speechConfig;
  }

  async getBlobUrl(fileName) {
    await this.ensureServicesReady();
    
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      return blockBlobClient.url;
    } catch (error) {
      logger.error('Error getting blob URL:', error);
      throw error;
    }
  }

  async deleteBlobFile(fileName) {
    await this.ensureServicesReady();
    
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      await blockBlobClient.delete();
      return true;
    } catch (error) {
      logger.error('Error deleting blob file:', error);
      throw error;
    }
  }
}

module.exports = new AzureServices();
