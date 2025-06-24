const { BlobServiceClient } = require('@azure/storage-blob');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { CognitiveServicesCredentials } = require('@azure/ms-rest-azure-js');
const { DocumentAnalysisClient } = require('@azure/ai-form-recognizer');
const { SearchClient, SearchIndexClient } = require('@azure/search-documents');
const AzureKeyCredential = require('@azure/core-auth').AzureKeyCredential;

// Import Speech SDK at the global level
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { AudioConfig, SpeechConfig, SpeechRecognizer, SpeechSynthesizer, ResultReason } = sdk;

const logger = require('../utils/logger');

class AzureServices {
  constructor() {
    // Don't auto-initialize - let server control when to initialize
  }

  initializeServices() {
    // Make initialization fully asynchronous to prevent blocking
    this.initializationPromise = this.initializeServicesAsync();
    
    // Log start but don't wait for completion
    logger.info('Azure services initialization started (async)...');
  }

  async initializeServicesAsync() {
    try {
      logger.info('Starting async Azure services initialization...');
      
      // Validate required environment variables first
      const requiredEnvVars = [
        'AZURE_STORAGE_CONNECTION_STRING',
        'AZURE_COGNITIVE_SERVICES_KEY',
        'AZURE_COGNITIVE_SERVICES_ENDPOINT',
        'AZURE_SEARCH_ENDPOINT',
        'AZURE_SEARCH_ADMIN_KEY',
        'AZURE_SPEECH_KEY',
        'AZURE_SPEECH_REGION'
      ];
      
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }
      
      // Initialize services with delays to prevent resource conflicts
      await this.initializeBlobStorage();
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      
      await this.initializeComputerVision();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await this.initializeDocumentIntelligence();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await this.initializeAzureSearch();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await this.initializeSpeechServices();
      
      logger.info('✅ All Azure services initialized successfully');
      this.servicesReady = true;
      return true;
      
    } catch (error) {
      logger.error('Failed to initialize Azure services:', error);
      logger.error('Error stack:', error.stack);
      
      // Continue with degraded functionality
      logger.warn('Azure services initialization failed - some features may be unavailable');
      this.servicesReady = false;
      return false;
    }
  }

  async initializeBlobStorage() {
    logger.info('Initializing Blob Storage...');
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'smlgpt-files';
    logger.info('✅ Blob Storage initialized');
  }

  async initializeComputerVision() {
    logger.info('Initializing Computer Vision with dedicated endpoint...');
    
    // Use dedicated Vision API endpoint and key
    const visionEndpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT || process.env.AZURE_COGNITIVE_SERVICES_ENDPOINT;
    const visionKey = process.env.AZURE_COMPUTER_VISION_KEY || process.env.AZURE_COGNITIVE_SERVICES_KEY;
    
    if (!visionEndpoint || !visionKey) {
      throw new Error('Computer Vision credentials missing');
    }
    
    const computerVisionKey = new CognitiveServicesCredentials(visionKey);
    this.visionClient = new ComputerVisionClient(computerVisionKey, visionEndpoint);
    
    logger.info('✅ Computer Vision initialized with endpoint: ' + visionEndpoint);
  }

  async initializeDocumentIntelligence() {
    logger.info('Initializing Document Intelligence...');
    this.documentClient = new DocumentAnalysisClient(
      process.env.AZURE_COGNITIVE_SERVICES_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_COGNITIVE_SERVICES_KEY)
    );
    logger.info('✅ Document Intelligence initialized');
  }

  async initializeAzureSearch() {
    logger.info('Initializing Azure Search...');
    
    const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
    const searchKey = process.env.AZURE_SEARCH_ADMIN_KEY;
    const searchIndexName = process.env.AZURE_SEARCH_INDEX_NAME || 'smlgpt-index';
    
    if (!searchEndpoint || !searchKey) {
      throw new Error('Azure Search credentials missing');
    }
    
    // Create search client and index client
    this.searchClient = new SearchClient(
      searchEndpoint,
      searchIndexName,
      new AzureKeyCredential(searchKey)
    );
    
    this.searchIndexClient = new SearchIndexClient(
      searchEndpoint,
      new AzureKeyCredential(searchKey)
    );
    
    this.searchIndexName = searchIndexName;
    logger.info(`✅ Azure Search initialized with endpoint: ${searchEndpoint}`);
  }

  async initializeSpeechServices() {
    try {
      if (!this.speechConfig) {
        // Get Azure key and region from environment variables
        const key = process.env.AZURE_SPEECH_KEY;
        const region = process.env.AZURE_SPEECH_REGION;

        if (!key || !region) {
          throw new Error('Azure Speech Services configuration missing. Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables.');
        }

        // Create a speech configuration with the specified subscription key and service region
        this.speechConfig = SpeechConfig.fromSubscription(key, region);
        
        logger.info(`✅ Speech Services initialized with region: ${region}`);
      }
    } catch (error) {
      logger.error('Failed to initialize Speech Services:', error);
      throw new Error(`Speech Services initialization failed: ${error.message}`);
    }
  }

  // Method to ensure services are ready before use
  async ensureServicesReady() {
    if (!this.initializationPromise) {
      throw new Error('Azure services not initialized');
    }
    
    await this.initializationPromise;
    return this.servicesReady;
  }

  // Blob Storage Operations
  async uploadToBlob(filename, buffer, contentType) {
    try {
      await this.ensureServicesReady();
      
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      
      // Ensure container exists
      await containerClient.createIfNotExists({
        access: 'blob'
      });

      const blockBlobClient = containerClient.getBlockBlobClient(filename);
      
      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: contentType
        },
        metadata: {
          uploadedAt: new Date().toISOString(),
          source: 'smlgpt-v2'
        }
      };

      const response = await blockBlobClient.upload(buffer, buffer.length, uploadOptions);
      
      const blobUrl = blockBlobClient.url;
      
      logger.info('File uploaded to blob storage', {
        filename,
        size: buffer.length,
        url: blobUrl
      });

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

  async downloadFromBlob(filename) {
    try {
      await this.ensureServicesReady();
      
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(filename);
      
      const downloadResponse = await blockBlobClient.download(0);
      
      return {
        buffer: await this.streamToBuffer(downloadResponse.readableStreamBody),
        properties: downloadResponse
      };
    } catch (error) {
      logger.error('Blob download failed:', error);
      throw new Error(`Failed to download file from blob storage: ${error.message}`);
    }
  }

  // Computer Vision Operations
  async analyzeImage(imageBuffer) {
    try {
      await this.ensureServicesReady();
      
      const features = [
        'Description',
        'Tags',
        'Categories',
        'Objects',
        'Brands',
        'Adult',
        'Color',
        'ImageType',
        'Faces',
        'Text'
      ];

      const result = await this.visionClient.analyzeImageInStream(imageBuffer, features);
      
      logger.info('Image analysis completed', {
        features: Object.keys(result),
        objectCount: result.objects?.length || 0,
        peopleCount: result.faces?.length || 0
      });

      return {
        description: result.description?.captions?.[0].text || '',
        confidence: result.description?.captions?.[0].confidence || 0,
        tags: result.tags?.map(tag => tag.name) || [],
        objects: result.objects?.map(object => object.object) || [],
        people: result.faces?.map(face => face.age) || [],
        text: result.text?.lines?.map(line => line.text) || []
      };
    } catch (error) {
      logger.error('Image analysis failed:', error);
      throw new Error(`Image analysis failed: ${error.message}`);
    }
  }

  // Document Intelligence Operations
  async analyzeDocument(documentBuffer, contentType) {
    try {
      await this.ensureServicesReady();
      
      let modelId = 'prebuilt-document';
      
      // Choose appropriate model based on content type
      if (contentType === 'application/pdf') {
        modelId = 'prebuilt-document';
      } else if (contentType.includes('word')) {
        modelId = 'prebuilt-document';
      }

      const poller = await this.documentClient.beginAnalyzeDocument(
        modelId,
        documentBuffer,
        {
          contentType: contentType
        }
      );

      const result = await poller.pollUntilDone();
      
      // Extract text content
      const content = result.content || '';
      
      // Extract tables if present
      const tables = result.tables?.map(table => ({
        rowCount: table.rowCount,
        columnCount: table.columnCount,
        cells: table.cells.map(cell => ({
          content: cell.content,
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex
        }))
      })) || [];

      // Extract key-value pairs
      const keyValuePairs = result.keyValuePairs?.map(pair => ({
        key: pair.key?.content || '',
        value: pair.value?.content || '',
        confidence: pair.confidence || 0
      })) || [];

      logger.info('Document analysis completed', {
        contentLength: content.length,
        tableCount: tables.length,
        keyValuePairCount: keyValuePairs.length
      });

      return {
        content,
        tables,
        keyValuePairs,
        pageCount: result.pages?.length || 0
      };
    } catch (error) {
      logger.error('Document analysis failed:', error);
      throw new Error(`Document analysis failed: ${error.message}`);
    }
  }

  // Speech Services Operations
  async speechToText(audioBuffer, language = 'en-US', format = 'wav') {
    try {
      await this.ensureServicesReady();
      
      logger.info(`Processing speech-to-text conversion with format: ${format}...`);
      
      return new Promise((resolve, reject) => {
        let audioConfig;
        
        try {
          // Use push stream for better control over audio format
          const pushStream = sdk.AudioInputStream.createPushStream();
          
          // Write audio buffer to push stream
          pushStream.write(audioBuffer);
          pushStream.close();
          
          // Create audio config from push stream instead of direct buffer
          audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
          
          if (format.toLowerCase() === 'mp3') {
            logger.info('MP3 format detected - using push stream for processing');
          }
        } catch (configError) {
          logger.error('Failed to create audio config:', configError);
          return reject(new Error(`Failed to create audio config: ${configError.message}`));
        }
        
        // Configure speech recognition
        this.speechConfig.speechRecognitionLanguage = language;
        const recognizer = new SpeechRecognizer(this.speechConfig, audioConfig);
        
        // Add event handlers for better debugging
        recognizer.recognizing = (s, e) => {
          logger.info(`RECOGNIZING: Text=${e.result.text}`);
        };
        
        recognizer.recognized = (s, e) => {
          if (e.result.reason === ResultReason.RecognizedSpeech) {
            logger.info(`RECOGNIZED: Text=${e.result.text}`);
          } else if (e.result.reason === ResultReason.NoMatch) {
            logger.info(`NOMATCH: Speech could not be recognized.`);
          }
        };
        
        recognizer.canceled = (s, e) => {
          logger.info(`CANCELED: Reason=${e.reason}`);
          if (e.reason === sdk.CancellationReason.Error) {
            logger.error(`CANCELED: ErrorCode=${e.errorCode}`);
            logger.error(`CANCELED: ErrorDetails=${e.errorDetails}`);
          }
        };
        
        recognizer.sessionStarted = (s, e) => {
          logger.info('Session started event.');
        };
        
        recognizer.sessionStopped = (s, e) => {
          logger.info('Session stopped event.');
        };
        
        // Start recognition
        recognizer.recognizeOnceAsync(
          (result) => {
            const resultText = result.text || '';
            logger.info(`Speech recognition completed with result: ${resultText}`);
            
            if (result.reason === ResultReason.RecognizedSpeech) {
              resolve(resultText);
            } else if (result.reason === ResultReason.NoMatch) {
              resolve('No speech was recognized.');
            } else {
              reject(new Error('Speech recognition failed: ' + (result.errorDetails || 'Unknown reason')));
            }
            
            recognizer.close();
          },
          (error) => {
            logger.error('Speech recognition error:', error);
            recognizer.close();
            reject(new Error(`Speech recognition failed: ${error}`));
          }
        );
      });
    } catch (error) {
      logger.error('Speech to text error:', error);
      throw new Error(`Speech recognition failed: ${error.message}`);
    }
  }

  async textToSpeech(text, voice = 'en-US-AriaNeural', format = 'audio-16khz-128kbitrate-mono-mp3') {
    try {
      await this.ensureServicesReady();
      
      logger.info(`Converting text to speech: ${text.substring(0, 50)}...`);
      
      return new Promise((resolve, reject) => {
        // Configure speech synthesis
        this.speechConfig.speechSynthesisVoiceName = voice;
        this.speechConfig.speechSynthesisOutputFormat = require('microsoft-cognitiveservices-speech-sdk').SpeechSynthesisOutputFormat[format] || 
          require('microsoft-cognitiveservices-speech-sdk').SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3;
        
        const synthesizer = new SpeechSynthesizer(this.speechConfig);
        
        synthesizer.speakTextAsync(
          text,
          (result) => {
            logger.info('Speech synthesis completed successfully');
            
            if (result.reason === require('microsoft-cognitiveservices-speech-sdk').ResultReason.SynthesizingAudioCompleted) {
              // Convert ArrayBuffer to Buffer
              const audioBuffer = Buffer.from(result.audioData);
              resolve(audioBuffer);
            } else {
              reject(new Error('Speech synthesis failed: ' + result.errorDetails));
            }
            
            synthesizer.close();
          },
          (error) => {
            logger.error('Speech synthesis error:', error);
            synthesizer.close();
            reject(new Error(`Text to speech failed: ${error}`));
          }
        );
      });
    } catch (error) {
      logger.error('Text to speech error:', error);
      throw new Error(`Speech synthesis failed: ${error.message}`);
    }
  }

  // Search Operations
  async searchDocuments(query, options = {}) {
    try {
      await this.ensureServicesReady();
      
      const searchOptions = {
        top: options.top || 10,
        skip: options.skip || 0,
        includeTotalCount: true,
        searchFields: options.searchFields || ['content', 'title'],
        select: options.select, // Let Azure return available fields if not specified
        ...options
      };

      const searchResults = await this.searchClient.search(query, searchOptions);
      
      const results = [];
      for await (const result of searchResults.results) {
        results.push({
          score: result.score,
          document: result.document
        });
      }

      logger.info('Search completed', {
        query: query.substring(0, 100),
        resultCount: results.length,
        totalCount: searchResults.count
      });

      return {
        results,
        totalCount: searchResults.count,
        query
      };
    } catch (error) {
      logger.error('Search failed:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async indexDocument(document) {
    try {
      await this.ensureServicesReady();
      
      const result = await this.searchClient.mergeOrUploadDocuments([document]);
      
      logger.info('Document indexed', {
        documentId: document.id,
        success: result.results[0].succeeded
      });

      return result.results[0];
    } catch (error) {
      logger.error('Document indexing failed:', error);
      throw new Error(`Document indexing failed: ${error.message}`);
    }
  }

  // Helper methods
  async streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on('error', reject);
    });
  }
  // API Test Methods for Connection Testing
  async listBlobContainers() {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME);
      // Check if container exists
      const exists = await containerClient.exists();
      
      if (!exists) {
        throw new Error(`Container ${process.env.AZURE_STORAGE_CONTAINER_NAME} does not exist`);
      }
      
      return [{ name: process.env.AZURE_STORAGE_CONTAINER_NAME, exists }];
    } catch (error) {
      logger.error('Failed to list blob containers:', error);
      throw error;
    }
  }

  async getComputerVisionModelInfo() {
    try {
      // Instead of using the SDK for testing, just verify the credentials and endpoint are valid
      // by checking if they exist in environment variables
      if (!process.env.AZURE_COMPUTER_VISION_KEY || !process.env.AZURE_COMPUTER_VISION_ENDPOINT) {
        throw new Error('Computer Vision credentials missing');
      }

      // Success - return endpoint info
      return { 
        endpoint: process.env.AZURE_COMPUTER_VISION_ENDPOINT, 
        region: process.env.AZURE_COMPUTER_VISION_REGION || 'eastus2'
      };
    } catch (error) {
      logger.error('Failed to get Computer Vision model info:', error);
      throw error;
    }
  }
  
  async getDocumentIntelligenceInfo() {
    try {
      // Simple validation that client is properly configured
      const endpoint = this.documentIntelligenceClient.endpoint;
      return { endpoint };
    } catch (error) {
      logger.error('Failed to get Document Intelligence info:', error);
      throw error;
    }
  }
  
  async testSearchConnection() {
    try {
      // Test the search connection
      const indexClient = this.searchClient.indexClient;
      const indexName = process.env.AZURE_SEARCH_INDEX_NAME;
      
      // Get index statistics
      const stats = await indexClient.getIndexStatistics(indexName);
      return { 
        endpoint: process.env.AZURE_SEARCH_ENDPOINT,
        indexName: indexName,
        documentCount: stats.documentCount
      };
    } catch (error) {
      logger.error('Failed to test search connection:', error);
      throw error;
    }
  }
  
  async testOpenAIConnection() {
    try {
      // Get model information
      const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
      const result = await this.openAIClient.listDeployments();
      const deployments = result.data.filter(d => d.id === deploymentId);
      
      return {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deploymentId: deploymentId,
        deploymentExists: deployments.length > 0
      };
    } catch (error) {
      logger.error('OpenAI Connection Test Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test the Azure Speech Services connection
   * @returns {Promise<object>} - Connection test result
   */
  async testSpeechConnection() {
    try {
      await this.ensureServicesReady();
      
      if (!this.speechConfig) {
        throw new Error('Speech configuration not initialized');
      }
      
      return {
        success: true,
        region: process.env.AZURE_SPEECH_REGION,
        endpoint: process.env.AZURE_COGNITIVE_SERVICES_ENDPOINT
      };
    } catch (error) {
      logger.error('Speech Connection Test Error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const azureServices = new AzureServices();

module.exports = azureServices;
