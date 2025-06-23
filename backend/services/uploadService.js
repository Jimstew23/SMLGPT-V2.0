const { getAzureMultiService } = require('./azureMultiService');
const chatService = require('./chatService');
const searchService = require('./searchService');
const documentStore = require('./documentStore');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class UploadService {
  constructor() {
    this.supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    this.supportedDocumentTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  }

  async processFileUpload(file) {
    try {
      const startTime = Date.now();
      const fileId = uuidv4();
      const timestamp = new Date().toISOString();
      
      logger.info('Processing file upload', {
        fileId,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      });

      // Validate file type
      const isImage = this.supportedImageTypes.includes(file.mimetype);
      const isDocument = this.supportedDocumentTypes.includes(file.mimetype);
      
      if (!isImage && !isDocument) {
        throw new Error(`Unsupported file type: ${file.mimetype}`);
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const filename = `${fileId}_${Date.now()}${fileExtension}`;

      // Upload to Azure Blob Storage
      const azureMultiService = getAzureMultiService();
      const blobResult = await azureMultiService.uploadToBlob(
        filename,
        file.buffer,
        file.mimetype
      );

      let analysisResult = {};
      let extractedContent = '';
      let searchDocument = null;

      if (isImage) {
        // Process image with Computer Vision and GPT-4.1
        analysisResult = await this.processImageFile(file.buffer, file.originalname);
        extractedContent = analysisResult.vision_analysis?.caption || '';
        
        // Create search document for image
        searchDocument = {
          id: fileId,
          title: file.originalname,
          content: analysisResult.safety_analysis || extractedContent,
          summary: analysisResult.vision_analysis?.caption || '',
          url: blobResult.url,
          file_type: 'image',
          mime_type: file.mimetype,
          file_size: file.size,
          vision_analysis: analysisResult.vision_analysis,
          safety_analysis: analysisResult.safety_analysis
        };

      } else if (isDocument) {
        // Process document with Document Intelligence
        analysisResult = await this.processDocumentFile(file.buffer, file.mimetype, file.originalname);
        extractedContent = analysisResult.content || '';
        
        // Create search document for document
        searchDocument = {
          id: fileId,
          title: file.originalname,
          content: extractedContent,
          summary: extractedContent.substring(0, 500) + (extractedContent.length > 500 ? '...' : ''),
          url: blobResult.url,
          file_type: 'document',
          mime_type: file.mimetype,
          file_size: file.size,
          page_count: analysisResult.pageCount || 0,
          tables: analysisResult.tables || []
        };
      }

      // Generate embeddings and index the document
      if (searchDocument && extractedContent) {
        try {
          const embedding = await chatService.generateEmbedding(extractedContent);
          searchDocument.embedding = embedding;
          
          // Index document in Azure Cognitive Search
          await searchService.indexDocument(searchDocument);
          
          logger.info('Document indexed successfully', {
            fileId,
            contentLength: extractedContent.length,
            hasEmbedding: !!embedding
          });
        } catch (embeddingError) {
          logger.error('Failed to generate embedding or index document:', embeddingError);
          // Continue without embedding - document is still uploaded and analyzed
        }
      }

      const duration = Date.now() - startTime;

      // Store document in document store for chat integration
      try {
        const documentData = {
          filename: file.originalname,
          content: extractedContent,
          contentType: file.mimetype,
          size: file.size,
          userId: 'default', // In production, this would come from user authentication
          blobUrl: blobResult.url, // Add blobUrl for image analysis
          metadata: {
            blobUrl: blobResult.url,
            storedFilename: filename,
            uploadedAt: timestamp,
            fileType: isImage ? 'image' : 'document',
            analysisResult: analysisResult,
            indexed: !!searchDocument
          }
        };

        // CRITICAL: Ensure document store operation completes BEFORE upload response
        await new Promise((resolve) => {
          documentStore.storeDocument(fileId, documentData);
          // Small delay to ensure document is fully stored and accessible
          setTimeout(resolve, 100);
        });
        
        logger.info('Document stored in document store', {
          fileId,
          filename: file.originalname,
          contentLength: extractedContent?.length || 0,
          hasContent: !!extractedContent
        });
        
      } catch (storeError) {
        logger.error('Failed to store document in document store:', storeError);
        // Continue with upload response even if store fails
      }

      const result = {
        file_id: fileId,
        filename: file.originalname,
        stored_filename: filename,
        file_type: isImage ? 'image' : 'document',
        mime_type: file.mimetype,
        file_size: file.size,
        blob_url: blobResult.url,
        processing_time_ms: duration,
        analysis: analysisResult,
        indexed: !!searchDocument,
        status: 'success'
      };

      logger.info('File upload processing completed', {
        fileId,
        duration: `${duration}ms`,
        analysisType: isImage ? 'image' : 'document',
        indexed: !!searchDocument
      });

      return result;

    } catch (error) {
      logger.error('File upload processing failed:', error);
      throw new Error(`File upload processing failed: ${error.message}`);
    }
  }

  async processImageFile(imageBuffer, originalName) {
    try {
      // Use Azure Computer Vision for initial analysis
      const azureMultiService = getAzureMultiService();
      const visionAnalysis = await azureMultiService.analyzeImage(imageBuffer);
      
      // Use GPT-4.1 Vision for safety analysis
      const safetyAnalysis = await chatService.analyzeImageSafety(
        imageBuffer,
        `Analyze this workplace image (${originalName}) for safety hazards and compliance with Georgia-Pacific SML standards.`
      );
      
      return {
        vision_analysis: visionAnalysis,
        safety_analysis: safetyAnalysis.safety_analysis,
        processing_time_ms: safetyAnalysis.processing_time_ms
      };
      
    } catch (error) {
      logger.error('Image processing failed:', error);
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  async processDocumentFile(documentBuffer, mimeType, originalName) {
    try {
      // Use Azure Document Intelligence for text extraction
      const azureMultiService = getAzureMultiService();
      const documentAnalysis = await azureMultiService.analyzeDocument(documentBuffer, mimeType);
      
      // Use GPT-4.1 to analyze extracted content for safety relevance
      if (documentAnalysis.content) {
        const safetyAnalysis = await chatService.processChat({
          message: `Analyze this document content for safety-related information, procedures, and compliance with Georgia-Pacific SML standards:\n\n${documentAnalysis.content.substring(0, 4000)}`,
          include_search: false
        });
        
        return {
          ...documentAnalysis,
          safety_analysis: safetyAnalysis.response
        };
      }
      
      return documentAnalysis;
      
    } catch (error) {
      logger.error('Document processing failed:', error);
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  async getFileInfo(fileId) {
    try {
      // Get file information from search index
      const searchResult = await searchService.getDocument(fileId);
      
      if (!searchResult) {
        throw new Error('File not found');
      }
      
      return searchResult;
      
    } catch (error) {
      logger.error('Failed to get file info:', error);
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  async deleteFile(fileId) {
    try {
      // Get file info first
      const fileInfo = await this.getFileInfo(fileId);
      
      // Delete from blob storage
      const filename = fileInfo.stored_filename || fileInfo.filename;
      const azureMultiService = getAzureMultiService();
      await azureMultiService.blobServiceClient
        .getContainerClient(azureMultiService.containerName)
        .getBlockBlobClient(filename)
        .delete();
      
      // Remove from search index
      await searchService.deleteDocument(fileId);
      
      logger.info('File deleted successfully', { fileId, filename });
      
      return { success: true, file_id: fileId };
      
    } catch (error) {
      logger.error('File deletion failed:', error);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  async listFiles(options = {}) {
    try {
      const searchOptions = {
        searchFields: ['title', 'file_type'],
        select: ['id', 'title', 'file_type', 'mime_type', 'file_size', 'url'],
        top: options.limit || 50,
        skip: options.offset || 0
      };

      let query = '*';
      if (options.file_type) {
        query = `file_type:${options.file_type}`;
      }
      if (options.search) {
        query = options.search;
      }

      const results = await searchService.searchDocuments(query, searchOptions);
      
      return {
        files: results.results.map(r => r.document),
        total_count: results.totalCount,
        limit: searchOptions.top,
        offset: searchOptions.skip
      };
      
    } catch (error) {
      logger.error('Failed to list files:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  // Utility methods
  getFileTypeFromMimeType(mimeType) {
    if (this.supportedImageTypes.includes(mimeType)) {
      return 'image';
    } else if (this.supportedDocumentTypes.includes(mimeType)) {
      return 'document';
    }
    return 'unknown';
  }

  validateFileSize(size, maxSize = 50 * 1024 * 1024) { // 50MB default
    return size <= maxSize;
  }

  sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }
}

// Create singleton instance
const uploadService = new UploadService();

module.exports = uploadService;
