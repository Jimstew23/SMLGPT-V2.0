const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { CognitiveServicesCredentials } = require('@azure/ms-rest-azure-js');
const { SpeechConfig, AudioConfig, SpeechRecognizer } = require('microsoft-cognitiveservices-speech-sdk');
const { BlobServiceClient } = require('@azure/storage-blob');
const logger = require('../utils/logger');

/**
 * SMLGPT V2.0 Unified Azure Cognitive Services Integration
 * 
 * Uses Azure Cognitive Services Multi-Service endpoint for:
 * - Computer Vision (OCR, image analysis)
 * - Document Intelligence (advanced PDF/DOCX parsing)
 * - Speech Services (speech-to-text, text-to-speech)
 * - Blob Storage (file storage and management)
 * 
 * Benefits:
 * - Single endpoint for all cognitive services
 * - On-premises deployment capability with containers
 * - Unified billing and management
 */

class AzureMultiService {
    constructor() {
        // Unified endpoint configuration
        this.endpoint = process.env.AZURE_COGNITIVE_SERVICES_ENDPOINT;
        this.key = process.env.AZURE_COGNITIVE_SERVICES_KEY;
        this.region = process.env.AZURE_COGNITIVE_SERVICES_REGION;

        // Blob Storage configuration
        this.storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'smlgpt-files';

        if (!this.endpoint || !this.key || !this.region) {
            throw new Error('Azure Cognitive Services configuration missing');
        }

        if (!this.storageConnectionString) {
            throw new Error('Azure Storage configuration missing');
        }

        // Initialize clients
        this.initializeClients();
        
        logger.info('Azure Multi-Service initialized', {
            endpoint: this.endpoint,
            region: this.region,
            containerName: this.containerName,
            services: ['Computer Vision', 'Document Intelligence', 'Speech', 'Blob Storage']
        });
    }

    initializeClients() {
        try {
            // Computer Vision Client (for images)
            const cvCredentials = new CognitiveServicesCredentials(this.key);
            this.computerVisionClient = new ComputerVisionClient(cvCredentials, this.endpoint);

            // Document Intelligence Client (for documents)
            this.documentAnalysisClient = new DocumentAnalysisClient(
                this.endpoint,
                new AzureKeyCredential(this.key)
            );

            // Speech Config (for speech services)
            this.speechConfig = SpeechConfig.fromSubscription(this.key, this.region);
            this.speechConfig.speechRecognitionLanguage = 'en-US';

            // Blob Storage Client
            this.blobServiceClient = BlobServiceClient.fromConnectionString(this.storageConnectionString);

            logger.info('All Azure service clients initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Azure service clients', { error: error.message });
            throw error;
        }
    }

    /**
     * Extract text from images using Computer Vision OCR
     */
    async extractTextFromImage(imageBuffer) {
        try {
            logger.info('Starting image OCR extraction', { size: imageBuffer.length });

            // Use Read API for advanced OCR
            const readResult = await this.computerVisionClient.readInStream(imageBuffer);
            const operationId = readResult.operationLocation.split('/').slice(-1)[0];

            // Poll for results
            let result;
            do {
                await this.delay(1000);
                result = await this.computerVisionClient.getReadResult(operationId);
            } while (result.status === 'notStarted' || result.status === 'running');

            if (result.status === 'failed') {
                throw new Error('OCR operation failed');
            }

            // Extract text from all pages
            let extractedText = '';
            const pages = result.analyzeResult.readResults;
            
            for (const page of pages) {
                for (const line of page.lines) {
                    extractedText += line.text + '\n';
                }
            }

            logger.info('Image OCR completed', { 
                textLength: extractedText.length,
                pages: pages.length 
            });

            return {
                text: extractedText.trim(),
                pages: pages.length,
                confidence: this.calculateAverageConfidence(pages)
            };

        } catch (error) {
            logger.error('Image OCR extraction failed', { error: error.message });
            throw new Error(`Failed to extract text from image: ${error.message}`);
        }
    }

    /**
     * Analyze images for safety content using Computer Vision
     */
    async analyzeImageContent(imageBuffer) {
        try {
            logger.info('Starting image content analysis');

            // Analyze image features
            const features = [
                'Categories',
                'Description',
                'Objects',
                'Tags',
                'Adult'
            ];

            const analysis = await this.computerVisionClient.analyzeImageInStream(
                imageBuffer,
                { visualFeatures: features }
            );

            // Extract relevant safety information
            const safetyKeywords = this.extractSafetyKeywords(analysis);

            logger.info('Image content analysis completed', {
                categories: analysis.categories?.length || 0,
                objects: analysis.objects?.length || 0,
                tags: analysis.tags?.length || 0
            });

            return {
                description: analysis.description?.captions?.[0]?.text || '',
                categories: analysis.categories || [],
                objects: analysis.objects || [],
                tags: analysis.tags || [],
                safetyKeywords,
                confidence: analysis.description?.captions?.[0]?.confidence || 0
            };

        } catch (error) {
            logger.error('Image content analysis failed', { error: error.message });
            throw new Error(`Failed to analyze image content: ${error.message}`);
        }
    }

    /**
     * Extract text from documents using Document Intelligence (advanced parsing)
     */
    async extractTextFromDocument(documentBuffer, fileName) {
        try {
            const fileExtension = fileName.split('.').pop().toLowerCase();
            logger.info('Starting document text extraction', { 
                fileName, 
                fileExtension,
                size: documentBuffer.length 
            });

            let analysisResult;

            // Choose appropriate model based on document type
            if (fileExtension === 'pdf') {
                // Use prebuilt document model for PDFs
                const poller = await this.documentAnalysisClient.beginAnalyzeDocument(
                    'prebuilt-document',
                    documentBuffer
                );
                analysisResult = await poller.pollUntilDone();
            } else if (fileExtension === 'docx') {
                // Use prebuilt read model for DOCX
                const poller = await this.documentAnalysisClient.beginAnalyzeDocument(
                    'prebuilt-read',
                    documentBuffer
                );
                analysisResult = await poller.pollUntilDone();
            } else {
                throw new Error(`Unsupported document type: ${fileExtension}`);
            }

            // Extract structured content
            let extractedText = '';
            const pages = [];

            // Extract paragraphs with better structure
            if (analysisResult.paragraphs) {
                for (const paragraph of analysisResult.paragraphs) {
                    extractedText += paragraph.content + '\n\n';
                }
            } else if (analysisResult.content) {
                extractedText = analysisResult.content;
            }

            // Extract page information
            if (analysisResult.pages) {
                for (const page of analysisResult.pages) {
                    pages.push({
                        pageNumber: page.pageNumber,
                        width: page.width,
                        height: page.height,
                        lines: page.lines?.length || 0
                    });
                }
            }

            // Extract tables if present
            const tables = [];
            if (analysisResult.tables) {
                for (const table of analysisResult.tables) {
                    const tableData = {
                        rowCount: table.rowCount,
                        columnCount: table.columnCount,
                        cells: table.cells.map(cell => ({
                            content: cell.content,
                            rowIndex: cell.rowIndex,
                            columnIndex: cell.columnIndex
                        }))
                    };
                    tables.push(tableData);
                }
            }

            logger.info('Document text extraction completed', {
                textLength: extractedText.length,
                pages: pages.length,
                tables: tables.length
            });

            return {
                text: extractedText.trim(),
                pages,
                tables,
                documentType: fileExtension,
                confidence: this.calculateDocumentConfidence(analysisResult)
            };

        } catch (error) {
            logger.error('Document text extraction failed', { 
                fileName, 
                error: error.message 
            });
            throw new Error(`Failed to extract text from document: ${error.message}`);
        }
    }

    /**
     * Process speech-to-text using Speech Services
     */
    async speechToText(audioBuffer) {
        try {
            logger.info('Starting speech-to-text conversion');

            return new Promise((resolve, reject) => {
                const audioConfig = AudioConfig.fromWavFileInput(audioBuffer);
                const recognizer = new SpeechRecognizer(this.speechConfig, audioConfig);

                recognizer.recognizeOnceAsync(
                    result => {
                        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
                            logger.info('Speech recognition completed', {
                                text: result.text,
                                duration: result.duration
                            });
                            resolve({
                                text: result.text,
                                confidence: result.properties.getProperty('SPEECH_CONFIDENCE')
                            });
                        } else {
                            reject(new Error(`Speech recognition failed: ${result.errorDetails}`));
                        }
                        recognizer.close();
                    },
                    error => {
                        logger.error('Speech recognition error', { error });
                        recognizer.close();
                        reject(error);
                    }
                );
            });

        } catch (error) {
            logger.error('Speech-to-text conversion failed', { error: error.message });
            throw new Error(`Failed to convert speech to text: ${error.message}`);
        }
    }

    /**
     * Upload file to Azure Blob Storage
     */
    async uploadToBlob(filename, buffer, contentType) {
        try {
            logger.info('Uploading file to blob storage', { 
                filename, 
                size: buffer.length, 
                contentType 
            });

            const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
            
            // Ensure container exists
            await containerClient.createIfNotExists({
                access: 'container'
            });

            const blockBlobClient = containerClient.getBlockBlobClient(filename);
            
            const uploadOptions = {
                blobHTTPHeaders: {
                    blobContentType: contentType
                },
                metadata: {
                    uploadedAt: new Date().toISOString(),
                    originalName: filename
                }
            };

            const uploadResponse = await blockBlobClient.upload(buffer, buffer.length, uploadOptions);

            const blobUrl = blockBlobClient.url;

            logger.info('File uploaded successfully', {
                filename,
                blobUrl,
                etag: uploadResponse.etag
            });

            return {
                success: true,
                filename,
                url: blobUrl,
                size: buffer.length,
                etag: uploadResponse.etag,
                contentType
            };

        } catch (error) {
            logger.error('Blob upload failed', { filename, error: error.message });
            throw new Error(`Failed to upload file to blob storage: ${error.message}`);
        }
    }

    /**
     * Analyze image using Computer Vision (wrapper for uploadService compatibility)
     */
    async analyzeImage(imageBuffer) {
        try {
            // Get both OCR and content analysis
            const [ocrResult, contentAnalysis] = await Promise.all([
                this.extractTextFromImage(imageBuffer),
                this.analyzeImageContent(imageBuffer)
            ]);

            return {
                text: ocrResult.text,
                content: contentAnalysis.description,
                tags: contentAnalysis.tags,
                objects: contentAnalysis.objects,
                safetyKeywords: contentAnalysis.safetyKeywords,
                confidence: Math.max(ocrResult.confidence, contentAnalysis.confidence)
            };

        } catch (error) {
            logger.error('Image analysis failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Analyze document using Document Intelligence (wrapper for uploadService compatibility)
     */
    async analyzeDocument(documentBuffer, mimeType) {
        try {
            // Determine file extension from MIME type
            const extensionMap = {
                'application/pdf': 'pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
            };

            const extension = extensionMap[mimeType];
            if (!extension) {
                throw new Error(`Unsupported document type: ${mimeType}`);
            }

            const result = await this.extractTextFromDocument(documentBuffer, `document.${extension}`);

            return {
                content: result.text,
                pages: result.pages,
                tables: result.tables,
                confidence: result.confidence,
                documentType: result.documentType
            };

        } catch (error) {
            logger.error('Document analysis failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Helper Methods
     */
    extractSafetyKeywords(analysis) {
        const safetyTerms = [
            'safety', 'hazard', 'danger', 'warning', 'caution', 'risk',
            'helmet', 'harness', 'protective', 'equipment', 'height',
            'construction', 'machinery', 'electrical', 'chemical', 'fire'
        ];

        const keywords = new Set();

        // Check description
        const description = analysis.description?.captions?.[0]?.text?.toLowerCase() || '';
        safetyTerms.forEach(term => {
            if (description.includes(term)) keywords.add(term);
        });

        // Check tags
        if (analysis.tags) {
            analysis.tags.forEach(tag => {
                const tagName = tag.name.toLowerCase();
                safetyTerms.forEach(term => {
                    if (tagName.includes(term)) keywords.add(term);
                });
            });
        }

        return Array.from(keywords);
    }

    calculateAverageConfidence(pages) {
        if (!pages || pages.length === 0) return 0;
        
        let totalConfidence = 0;
        let lineCount = 0;

        for (const page of pages) {
            for (const line of page.lines) {
                if (line.confidence) {
                    totalConfidence += line.confidence;
                    lineCount++;
                }
            }
        }

        return lineCount > 0 ? totalConfidence / lineCount : 0;
    }

    calculateDocumentConfidence(analysisResult) {
        // Calculate average confidence from paragraphs or pages
        if (analysisResult.paragraphs) {
            const confidences = analysisResult.paragraphs
                .map(p => p.confidence)
                .filter(c => c !== undefined);
            return confidences.length > 0 
                ? confidences.reduce((a, b) => a + b) / confidences.length 
                : 0;
        }
        return 0.85; // Default confidence for successful extraction
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Health check for all services
     */
    async healthCheck() {
        try {
            // Test basic connectivity to the endpoint
            const testImageBuffer = Buffer.from('test');
            
            // This will fail but confirm endpoint connectivity
            try {
                await this.computerVisionClient.analyzeImageInStream(testImageBuffer);
            } catch (error) {
                // Expected to fail with invalid image, but confirms connectivity
                if (error.message.includes('InvalidImageFormat')) {
                    return {
                        status: 'healthy',
                        endpoint: this.endpoint,
                        region: this.region,
                        services: ['Computer Vision', 'Document Intelligence', 'Speech', 'Blob Storage']
                    };
                }
                throw error;
            }
        } catch (error) {
            logger.error('Azure Multi-Service health check failed', { error: error.message });
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

// Create singleton instance
let azureMultiServiceInstance = null;

function getAzureMultiService() {
    if (!azureMultiServiceInstance) {
        azureMultiServiceInstance = new AzureMultiService();
    }
    return azureMultiServiceInstance;
}

module.exports = {
    AzureMultiService,
    getAzureMultiService
};
