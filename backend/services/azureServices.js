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

      // Initialize Search with DEDICATED endpoint (if not skipped)
      if (process.env.SKIP_SEARCH_INDEXING !== 'true') {
        this.searchClient = new SearchClient(
          process.env.AZURE_SEARCH_ENDPOINT,
          process.env.AZURE_SEARCH_INDEX_NAME,
          new AzureKeyCredential(process.env.AZURE_SEARCH_ADMIN_KEY)
        );

        this.searchIndexClient = new SearchIndexClient(
          process.env.AZURE_SEARCH_ENDPOINT,
          new AzureKeyCredential(process.env.AZURE_SEARCH_ADMIN_KEY)
        );
      }

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

  // Blob Storage Operations
  async uploadToBlob(filename, buffer, contentType) {
    await this.ensureServicesReady();
    
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists({ access: 'blob' });
      
      const blockBlobClient = containerClient.getBlockBlobClient(filename);
      const uploadOptions = {
        blobHTTPHeaders: { blobContentType: contentType },
        metadata: {
          uploadedAt: new Date().toISOString(),
          source: 'smlgpt-v2'
        }
      };

      const response = await blockBlobClient.upload(buffer, buffer.length, uploadOptions);
      const blobUrl = blockBlobClient.url;
      
      logger.info('File uploaded to blob storage', { filename, url: blobUrl });

      return {
        url: blobUrl,
        filename,
        size: buffer.length,
        etag: response.etag,
        lastModified: response.lastModified
      };
    } catch (error) {
      logger.error('Blob upload failed:', error);
      throw new Error(`Failed to upload file to blob storage: ${error.message}`);
    }
  }

  async deleteBlobFile(filename) {
    await this.ensureServicesReady();
    
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(filename);
      await blockBlobClient.delete();
      return true;
    } catch (error) {
      logger.error('Error deleting blob file:', error);
      throw error;
    }
  }

  getBlobUrl(fileName) {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    return blockBlobClient.url;
  }

  // Computer Vision Operations
  async analyzeImage(imageBuffer) {
    await this.ensureServicesReady();
    
    try {
      const features = ['Description', 'Tags', 'Categories', 'Objects', 'Brands', 'Adult'];
      const result = await this.visionClient.analyzeImageInStream(imageBuffer, { visualFeatures: features });
      
      logger.info('Image analysis completed', {
        features: Object.keys(result),
        objectCount: result.objects?.length || 0
      });

      return {
        description: result.description?.captions?.[0]?.text || '',
        confidence: result.description?.captions?.[0]?.confidence || 0,
        tags: result.tags?.map(tag => tag.name) || [],
        objects: result.objects?.map(obj => obj.object) || [],
        caption: result.description?.captions?.[0]?.text || ''
      };
    } catch (error) {
      logger.error('Image analysis failed:', error);
      throw new Error(`Image analysis failed: ${error.message}`);
    }
  }

  // Document Intelligence Operations
  async analyzeDocument(documentBuffer, mimeType) {
    await this.ensureServicesReady();
    
    try {
      const modelId = 'prebuilt-document';
      const poller = await this.documentClient.beginAnalyzeDocument(
        modelId,
        documentBuffer,
        { contentType: mimeType }
      );

      const result = await poller.pollUntilDone();
      const content = result.content || '';
      
      logger.info('Document analysis completed', {
        contentLength: content.length,
        pageCount: result.pages?.length || 0
      });

      return {
        content,
        text: content, // Alias for compatibility
        pages: result.pages || [],
        tables: result.tables || [],
        pageCount: result.pages?.length || 0
      };
    } catch (error) {
      logger.error('Document analysis failed:', error);
      throw new Error(`Document analysis failed: ${error.message}`);
    }
  }

  // Add alias for compatibility
  async extractTextFromDocument(documentBuffer, mimeType) {
    return this.analyzeDocument(documentBuffer, mimeType);
  }

  // Search Operations (if enabled)
  async searchDocuments(query, options = {}) {
    if (process.env.SKIP_SEARCH_INDEXING === 'true') {
      return { results: [], totalCount: 0 };
    }
    
    await this.ensureServicesReady();
    
    try {
      const searchOptions = {
        top: options.top || 10,
        skip: options.skip || 0,
        includeTotalCount: true
      };

      const searchResults = await this.searchClient.search(query, searchOptions);
      const results = [];
      
      for await (const result of searchResults.results) {
        results.push(result);
      }

      return {
        results,
        totalCount: searchResults.count || 0
      };
    } catch (error) {
      logger.error('Search failed:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async indexDocument(document) {
    if (process.env.SKIP_SEARCH_INDEXING === 'true') {
      logger.info('Search indexing skipped (SKIP_SEARCH_INDEXING=true)');
      return { succeeded: true };
    }
    
    await this.ensureServicesReady();
    
    try {
      const result = await this.searchClient.uploadDocuments([document]);
      return result.results[0];
    } catch (error) {
      logger.error('Document indexing failed:', error);
      throw error;
    }
  }

  // Speech Services
  async speechToText(audioBuffer, language = 'en-US', format = 'wav') {
    await this.ensureServicesReady();
    
    return new Promise((resolve, reject) => {
      try {
        const pushStream = sdk.AudioInputStream.createPushStream();
        pushStream.write(audioBuffer);
        pushStream.close();
        
        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
        this.speechConfig.speechRecognitionLanguage = language;
        const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);
        
        recognizer.recognizeOnceAsync(
          (result) => {
            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
              resolve(result.text);
            } else {
              reject(new Error('Speech recognition failed'));
            }
            recognizer.close();
          },
          (error) => {
            recognizer.close();
            reject(error);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  async textToSpeech(text, voice = 'en-US-AriaNeural') {
    await this.ensureServicesReady();
    
    return new Promise((resolve, reject) => {
      this.speechConfig.speechSynthesisVoiceName = voice;
      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
      
      synthesizer.speakTextAsync(
        text,
        (result) => {
          const audioBuffer = Buffer.from(result.audioData);
          synthesizer.close();
          resolve(audioBuffer);
        },
        (error) => {
          synthesizer.close();
          reject(error);
        }
      );
    });
  }

  // Test/Debug methods
  async getComputerVisionModelInfo() {
    return {
      endpoint: process.env.AZURE_COMPUTER_VISION_ENDPOINT,
      region: process.env.AZURE_COMPUTER_VISION_REGION || 'eastus2'
    };
  }

  getSpeechConfig() {
    return this.speechConfig;
  }
}

module.exports = new AzureServices();
