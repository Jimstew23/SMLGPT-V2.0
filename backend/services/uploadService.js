const azureServices = require('./azureServices');
const chatService = require('./chatService');
const searchService = require('./searchService');
const documentStore = require('./documentStore');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class UploadService {
  constructor() {
    this.supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    this.supportedDocumentTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  }

  async processFileUpload(file) {
    const startTime = Date.now();
    const fileId = uuidv4();
    const timestamp = new Date().toISOString();
    
    logger.info('=== FILE UPLOAD PROCESS STARTED ===', {
        fileId,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        timestamp
    });

    try {
        // Generate image hash for caching
        let imageHash = null;
        if (file.mimetype.startsWith('image/')) {
            imageHash = cacheService.generateImageHash(file.buffer);
            
            // Check if we have cached analysis
            const cachedAnalysis = await cacheService.getCachedAnalysis(imageHash);
            if (cachedAnalysis) {
                logger.info('Using cached analysis for image', { 
                    imageHash,
                    originalName: file.originalname 
                });
                
                const duration = Date.now() - startTime;
                return {
                    ...cachedAnalysis,
                    processing_time_ms: duration,
                    cached: true
                };
            }
        }

        // Step 1: Validate file type
        logger.info('Step 1: Validating file type...');
        const isImage = this.supportedImageTypes.includes(file.mimetype);
        const isDocument = this.supportedDocumentTypes.includes(file.mimetype);
        
        if (!isImage && !isDocument) {
            throw new Error(`Unsupported file type: ${file.mimetype}`);
        }
        logger.info('Step 1 Complete: File type valid', { isImage, isDocument });

        // Step 2: Generate unique filename
        logger.info('Step 2: Generating unique filename...');
        const fileExtension = path.extname(file.originalname);
        const filename = `${fileId}_${Date.now()}${fileExtension}`;
        logger.info('Step 2 Complete: Filename generated', { filename });

        // Step 3: Upload to Azure Blob Storage
        logger.info('Step 3: Uploading to Blob Storage...');
        const blobResult = await azureServices.uploadToBlob(
            filename,
            file.buffer,
            file.mimetype
        );
        logger.info('Step 3 Complete: File uploaded to blob', { 
            blobUrl: blobResult.url,
            size: blobResult.size,
            etag: blobResult.etag
        });

        let analysisResult = {};
        let extractedContent = '';
        let searchDocument = null;

        if (file.mimetype.startsWith('image/')) {
            // Step 4: Process image
            logger.info('Step 4: Processing image with Computer Vision and GPT-4.1...');
            try {
                analysisResult = await this.processImageFile(file.buffer, file.originalname);
                extractedContent = analysisResult.vision_analysis?.caption || '';
                logger.info('Step 4 Complete: Image analyzed', { 
                    hasVisionAnalysis: !!analysisResult.vision_analysis,
                    hasSafetyAnalysis: !!analysisResult.safety_analysis,
                    extractedTextLength: extractedContent.length
                });
            } catch (imageError) {
                logger.error('Image processing failed', { 
                    error: imageError.message,
                    stack: imageError.stack 
                });
                throw imageError;
            }
            
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

        } else if (file.mimetype.startsWith('application/')) {
            // Step 4: Process document
            logger.info('Step 4: Processing document with Document Intelligence...');
            try {
                analysisResult = await this.processDocumentFile(file.buffer, file.mimetype, file.originalname);
                extractedContent = analysisResult.content || '';
                logger.info('Step 4 Complete: Document analyzed', { 
                    contentLength: extractedContent.length,
                    pageCount: analysisResult.pageCount || 0
                });
            } catch (docError) {
                logger.error('Document processing failed', { 
                    error: docError.message,
                    stack: docError.stack 
                });
                throw docError;
            }
            
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

        // Step 5: Generate embeddings and index
        if (searchDocument && extractedContent) {
            logger.info('Step 5: Generating embeddings and indexing...');
            try {
                // TEMPORARY: Skip embedding/search indexing to isolate issue
                const SKIP_SEARCH_INDEXING = process.env.SKIP_SEARCH_INDEXING === 'true'; // Toggle this to disable problematic Azure Search
                
                if (!SKIP_SEARCH_INDEXING) {
                    const embedding = await chatService.generateEmbedding(extractedContent);
                    searchDocument.embedding = embedding;
                    
                    await searchService.indexDocument(searchDocument);
                    
                    logger.info('Step 5 Complete: Document indexed', {
                        fileId,
                        contentLength: extractedContent.length,
                        hasEmbedding: !!embedding
                    });
                } else {
                    logger.warn('SEARCH INDEXING DISABLED - Skipping to isolate timeout issue');
                    logger.info('Step 5 Complete: Indexing step skipped (disabled)');
                }
                
            } catch (embeddingError) {
                logger.error('Embedding/indexing failed (continuing anyway):', embeddingError);
                // CRITICAL: Don't throw - continue with upload
            }
        }

        // Step 6: Store in document store
        logger.info('Step 6: Storing in document store...');
        try {
            const documentData = {
                filename: file.originalname,
                content: extractedContent,
                contentType: file.mimetype,
                size: file.size,
                userId: 'default',
                blobUrl: blobResult.url,
                metadata: {
                    blobUrl: blobResult.url,
                    storedFilename: filename,
                    uploadedAt: timestamp,
                    fileType: file.mimetype.startsWith('image/') ? 'image' : 'document',
                    analysisResult: analysisResult,
                    indexed: !!searchDocument
                }
            };

            documentStore.storeDocument(fileId, documentData);
            
            // Verify storage
            const storedDoc = documentStore.getDocument(fileId);
            if (!storedDoc) {
                throw new Error('Document storage verification failed');
            }
            
            logger.info('Step 6 Complete: Document stored', {
                fileId,
                filename: file.originalname,
                hasContent: !!extractedContent
            });
            
        } catch (storeError) {
            logger.error('Document store failed', { 
                error: storeError.message 
            });
            // Continue - file is still uploaded
        }

        const duration = Date.now() - startTime;

        const result = {
            file_id: fileId,
            filename: file.originalname,
            stored_filename: filename,
            file_type: file.mimetype.startsWith('image/') ? 'image' : 'document',
            mime_type: file.mimetype,
            file_size: file.size,
            blob_url: blobResult.url,
            processing_time_ms: duration,
            analysis: analysisResult,
            indexed: !!searchDocument,
            status: 'success'
        };

        logger.info('=== FILE UPLOAD PROCESS COMPLETED ===', {
            fileId,
            duration: `${duration}ms`,
            analysisType: file.mimetype.startsWith('image/') ? 'image' : 'document',
            indexed: !!searchDocument,
            success: true
        });

        // Cache result
        await cacheService.cacheResult(fileId, result);

        // Cache image analysis if applicable
        if (imageHash) {
            await cacheService.cacheImageAnalysis(imageHash, analysisResult);
        }

        return result;

    } catch (error) {
        logger.error('=== FILE UPLOAD PROCESS FAILED ===', {
            fileId,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        });
        throw new Error(`File upload processing failed: ${error.message}`);
    }
  }

  async processImageFile(imageBuffer, originalName) {
    try {
      // Use Azure Computer Vision for initial analysis
      const visionAnalysis = await azureServices.analyzeImage(imageBuffer);
      
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
      const documentAnalysis = await azureServices.extractTextFromDocument(documentBuffer, mimeType);
      
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
      await azureServices.blobServiceClient
        .getContainerClient(azureServices.containerName)
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

  // New parallel processing method for images
  async processImageFileParallel(imageBuffer, originalName) {
    try {
        logger.info('Starting parallel image processing...');
        
        // Run vision and safety analysis in parallel
        const [visionAnalysis, safetyAnalysis] = await Promise.all([
            // Azure Computer Vision with timeout
            Promise.race([
                (async () => {
                    return await azureServices.analyzeImage(imageBuffer);
                })(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Vision analysis timeout')), 30000)
                )
            ]),
            
            // GPT-4.1 Safety Analysis with timeout
            Promise.race([
                chatService.analyzeImageSafety(
                    imageBuffer,
                    `Analyze this workplace image (${originalName}) for safety hazards and compliance with Georgia-Pacific SML standards.`
                ),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Safety analysis timeout')), 45000)
                )
            ])
        ]);
        
        logger.info('Parallel processing completed successfully');
        
        return {
            vision_analysis: visionAnalysis,
            safety_analysis: safetyAnalysis.safety_analysis,
            processing_time_ms: safetyAnalysis.processing_time_ms
        };
        
    } catch (error) {
        logger.error('Parallel image processing failed, falling back to serial:', error);
        // Fallback to serial processing
        return await this.processImageFile(imageBuffer, originalName);
    }
  }
}

// Create singleton instance
const uploadService = new UploadService();

module.exports = uploadService;
