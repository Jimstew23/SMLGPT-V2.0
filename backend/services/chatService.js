const { AzureOpenAI } = require('openai');
const azureServices = require('./azureServices');
const searchService = require('./searchService');
const documentStore = require('./documentStore');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch'); // Required for fetchImageFromBlobUrl method

class ChatService {
  constructor() {
    // Initialize other non-client components
    this.loadSystemInstructions();
    
    // Client initialization flags
    this.clientsInitialized = false;
    this.openaiClient = null;
    this.embeddingClient = null;
  }

  ensureClientsInitialized() {
    if (!this.clientsInitialized) {
      this.initializeClients();
      this.clientsInitialized = true;
    }
  }

  initializeClients() {
    try {
      // Initialize Azure OpenAI client for chat (GPT-4.1)
      this.openaiClient = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      });

      // Initialize separate Azure OpenAI client for embeddings (embed-v-4-0-2)
      this.embeddingClient = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_EMBEDDING_API_KEY,
        endpoint: process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_EMBEDDING_API_VERSION,
      });

      logger.info('Azure OpenAI clients initialized successfully (chat + embeddings)');
    } catch (error) {
      logger.error('Failed to initialize Azure OpenAI clients:', error);
      throw error;
    }
  }

  async loadSystemInstructions() {
    try {
      // Load SMLGPT system instructions from config directory
      const instructionsPath = path.join(__dirname, '..', 'config', 'SMLGPT_system_instructions.txt');
      this.systemInstructions = await fs.readFile(instructionsPath, 'utf-8');
      
      logger.info('Georgia-Pacific 2025 SMLGPT system instructions loaded successfully', {
        length: this.systemInstructions.length,
        path: instructionsPath
      });
    } catch (error) {
      logger.error('Failed to load Georgia-Pacific 2025 SMLGPT system instructions:', error);
      // Fallback system instructions with critical safety requirements
      this.systemInstructions = `You are SMLGPT, an AI-powered safety analysis assistant for Georgia-Pacific's Save My Life (SML) program following 2025 compliance standards.

CRITICAL REQUIREMENTS:
- Apply Georgia-Pacific 2025 SML Compliance Standard to every response
- Use 10 Work Categories and 5 Critical Hazards exactly as defined
- Calculate Risk Ranking (Severity × Probability) for every hazard
- Apply Hierarchy of Controls (Elimination > Substitution > Engineering > Administrative > PPE)
- Identify both Prevention AND Recovery controls
- Match communication urgency to actual risk level (STOP for critical, HIGH RISK for serious)
- Never invent details - request clarification if information is missing

COMMUNICATION FRAMEWORK:
🛑 STOP! - Use for immediate life-threatening situations
⚠️ HIGH RISK ALERT - Use for serious hazards (Risk ≥15)
⚡ SAFETY CONCERN - Use for moderate issues
Professional tone - Use for routine guidance

Always prioritize worker safety and provide accurate, compliance-based safety analysis.`;
    }
  }

  async processChat({ message, conversation_id, include_search = false, image_data = null, document_references = [] }) {
    this.ensureClientsInitialized();
    try {
      const startTime = Date.now();
      
      // Generate conversation context from search
      let searchContext = '';
      if (include_search && message) {
        const searchResults = await searchService.searchDocuments({
          query: message,
          top: 5
        });
        
        if (searchResults.results.length > 0) {
          searchContext = this.buildContextFromSearch(searchResults.results);
        }
      }

      // Generate document context from uploaded files
      let documentContext = '';
      if (document_references && document_references.length > 0) {
        documentContext = await this.buildContextFromDocuments(document_references);
      }

      // Check for image references and perform vision analysis if needed
      const referencedImages = await this.getReferencedImages(document_references);
      let imageAnalysisResults = '';
      
      if (referencedImages.length > 0) {
        logger.info(`Found ${referencedImages.length} referenced images, performing vision analysis`);
        
        for (const imageDoc of referencedImages) {
          try {
            // Fetch the image data from blob storage
            const imageBuffer = await this.fetchImageFromBlobUrl(imageDoc.blobUrl);
            
            // Perform vision analysis
            const visionAnalysis = await this.analyzeImageSafety(
              imageBuffer,
              `Analyze this image (${imageDoc.filename}) in context of the user's question: ${message}`
            );
            
            imageAnalysisResults += `\n\n--- Vision Analysis for ${imageDoc.filename} ---\n${visionAnalysis.safety_analysis}`;
            
          } catch (imageError) {
            logger.error(`Failed to analyze image ${imageDoc.filename}:`, imageError);
            imageAnalysisResults += `\n\n--- ${imageDoc.filename} ---\nUnable to perform detailed visual analysis: ${imageError.message}`;
          }
        }
      }

      // Combine all context
      let combinedContext = '';
      if (searchContext && documentContext && imageAnalysisResults) {
        combinedContext = `${searchContext}\n\n--- Uploaded Documents ---\n${documentContext}\n\n--- Image Analysis ---\n${imageAnalysisResults}`;
      } else if (searchContext && documentContext) {
        combinedContext = `${searchContext}\n\n--- Uploaded Documents ---\n${documentContext}`;
      } else if (searchContext && imageAnalysisResults) {
        combinedContext = `${searchContext}\n\n--- Image Analysis ---\n${imageAnalysisResults}`;
      } else if (documentContext && imageAnalysisResults) {
        combinedContext = `--- Referenced Documents ---\n${documentContext}\n\n--- Image Analysis ---\n${imageAnalysisResults}`;
      } else if (searchContext) {
        combinedContext = searchContext;
      } else if (documentContext) {
        combinedContext = `--- Referenced Documents ---\n${documentContext}`;
      } else if (imageAnalysisResults) {
        combinedContext = `--- Image Analysis ---\n${imageAnalysisResults}`;
      }

      // Build messages array
      const messages = [
        {
          role: 'system',
          content: this.systemInstructions + (combinedContext ? `\n\nRelevant Context:\n${combinedContext}` : '')
        },
        {
          role: 'user',
          content: image_data ? [
            { type: 'text', text: message },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image_data.toString('base64')}`,
                detail: 'high'
              }
            }
          ] : message
        }
      ];

      // Call GPT-4.1
      const response = await this.openaiClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
        messages,
        max_tokens: 2000,
        temperature: 0.1, // Low temperature for consistent safety analysis
        top_p: 0.9
      });

      const aiResponse = response.choices[0].message.content;
      const duration = Date.now() - startTime;

      // Log the interaction
      logger.info('Chat completion successful', {
        conversation_id,
        messageLength: message.length,
        responseLength: aiResponse.length,
        duration: `${duration}ms`,
        hasImage: !!image_data,
        include_search,
        searchResultsCount: include_search ? (await searchService.searchDocuments({ query: message, top: 5 })).results.length : 0
      });

      // Analyze response for safety flags
      const safetyFlags = this.analyzeSafetyFlags(aiResponse);

      return {
        response: aiResponse,
        conversation_id: conversation_id || this.generateConversationId(),
        timestamp: new Date().toISOString(),
        context_used: !!combinedContext,
        processing_time_ms: duration,
        model_used: process.env.AZURE_OPENAI_DEPLOYMENT_NAME
      };

    } catch (error) {
      logger.error('Chat processing failed - DETAILED ERROR:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        status: error.status,
        response: error.response?.data,
        config: error.config?.url
      });
      console.error('FULL CHAT ERROR DETAILS:', error);
      throw new Error(`Chat processing failed: ${error.message}`);
    }
  }

  buildContextFromSearch(searchResults) {
    return searchResults.map((result, index) => {
      const doc = result.document;
      return `[${index + 1}] ${doc.title || 'Document'}
Content: ${doc.content?.substring(0, 300) || doc.summary || 'No content available'}...
Category: ${doc.category || 'General'}
`;
    }).join('\n');
  }

  async buildContextFromDocuments(document_references) {
    try {
      if (!document_references || document_references.length === 0) {
        logger.warn('No document references provided');
        return '';
      }

      logger.info('=== BUILDING DOCUMENT CONTEXT ===', { 
        documentCount: document_references.length,
        documentIds: document_references 
      });

      const documents = documentStore.getDocuments(document_references);
      
      if (documents.length === 0) {
        logger.error('No documents found in store for IDs:', document_references);
        // Try to list all documents in store for debugging
        const allDocs = documentStore.getAllDocuments();
        logger.info('All documents in store:', allDocs.map(d => ({ id: d.id, filename: d.filename })));
        return '';
      }

      logger.info('Found documents:', documents.map(d => ({
        id: d.id,
        filename: d.filename,
        type: d.contentType,
        hasBlobUrl: !!d.blobUrl
      })));

      // Build formatted context from document content
      const contextParts = documents.map(doc => {
        const content = doc.content || 'No content available';
        const contentPreview = content.length > 1500 ? 
          content.substring(0, 1500) + '\n[Content truncated...]' : 
          content;
        
        // Special handling for images
        let imageInfo = '';
        if (doc.contentType && doc.contentType.startsWith('image/')) {
          imageInfo = `\nIMAGE FILE: ${doc.filename}
Type: ${doc.contentType}
Blob URL: ${doc.blobUrl || 'NOT FOUND - THIS IS THE PROBLEM!'}
This is an image that should be analyzed using vision capabilities.`;
        }
        
        return `--- Document: ${doc.filename} ---
File Type: ${doc.contentType}
Uploaded: ${doc.uploadedAt}
Document ID: ${doc.id}
Content: ${contentPreview}${imageInfo}`;
      });

      const fullContext = contextParts.join('\n\n');
      
      logger.info('=== DOCUMENT CONTEXT BUILT ===', {
        documentsUsed: documents.length,
        totalContextLength: fullContext.length,
        documentNames: documents.map(d => d.filename),
        imageCount: documents.filter(d => d.contentType && d.contentType.startsWith('image/')).length
      });

      return fullContext;
    } catch (error) {
      logger.error('Error building context from documents:', error);
      return '';
    }
  }

  async getReferencedImages(documentReferences) {
    logger.info('=== GETTING REFERENCED IMAGES ===', {
      documentReferences,
      count: documentReferences ? documentReferences.length : 0
    });

    if (!documentReferences || documentReferences.length === 0) {
      logger.warn('No document references provided for image analysis');
      return [];
    }

    const imageDocuments = [];
    
    for (const docId of documentReferences) {
      try {
        const document = documentStore.getDocument(docId);
        logger.info(`Checking document ${docId}:`, {
          found: !!document,
          filename: document?.filename,
          type: document?.contentType,
          hasBlobUrl: !!document?.blobUrl
        });
        
        if (document && this.isImageFile(document.filename, document.contentType)) {
          if (document.blobUrl) {
            imageDocuments.push({
              id: document.id,
              filename: document.filename,
              mimeType: document.contentType,
              blobUrl: document.blobUrl,
              extractedText: document.extractedText || '',
              metadata: document.metadata || {}
            });
            
            logger.info(`✅ Found image for vision analysis: ${document.filename}`);
          } else {
            logger.error(`❌ Image ${document.filename} missing blobUrl!`);
          }
        }
      } catch (error) {
        logger.error(`Error retrieving document ${docId}:`, error);
      }
    }
    
    logger.info(`=== FOUND ${imageDocuments.length} IMAGES FOR ANALYSIS ===`);
    return imageDocuments;
  }

  isImageFile(filename, contentType) {
    if (contentType && contentType.startsWith('image/')) {
      return true;
    }
    if (filename) {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }
    return false;
  }

  async fetchImageFromBlobUrl(blobUrl) {
    try {
      logger.info('Fetching image from blob URL', {
        url: blobUrl,
        timestamp: new Date().toISOString()
      });
      
      // Validate blob URL format
      if (!blobUrl || typeof blobUrl !== 'string' || !blobUrl.startsWith('http')) {
        logger.error('Invalid blob URL format', { blobUrl });
        throw new Error(`Invalid blob URL format: ${blobUrl}`);
      }

      // Check if this is an Azure Blob URL and handle SAS token if needed
      if (blobUrl.includes('.blob.core.windows.net')) {
        // Define the SAS token - use environment variable
        const sasToken = process.env.AZURE_BLOB_SAS_TOKEN;
        
        if (!sasToken) {
          logger.error('AZURE_BLOB_SAS_TOKEN environment variable not set');
          throw new Error('SAS token not configured');
        }
        
        // If URL doesn't have authentication parameters, append SAS token
        if (!blobUrl.includes('?')) {
          const originalUrl = blobUrl;
          blobUrl = `${blobUrl}?${sasToken}`;
          logger.info('Added SAS token to blob URL', {
            originalUrl,
            newUrlLength: blobUrl.length
          });
        }
        
        // Try to get the blob directly using the Azure SDK first
        try {
          logger.info('Attempting to use Azure SDK to access blob');
          
          // Extract container and blob name from URL
          const urlParts = new URL(blobUrl);
          const pathParts = urlParts.pathname.split('/');
          const containerName = pathParts[1]; // First part after domain
          const blobName = pathParts.slice(2).join('/'); // Rest is blob path
          
          logger.info(`Parsed blob URL: container=${containerName}, blob=${blobName}`);
          
          // Get blob directly using Azure SDK
          const containerClient = azureServices.blobServiceClient.getContainerClient(containerName);
          const blobClient = containerClient.getBlobClient(blobName);
          
          // Download blob content
          const downloadResponse = await blobClient.download();
          const chunks = [];
          
          // Process chunks from download stream
          for await (const chunk of downloadResponse.readableStreamBody) {
            chunks.push(chunk);
          }
          
          // Combine chunks into a buffer
          const imageBuffer = Buffer.concat(chunks);
          
          logger.info('Successfully fetched image using Azure SDK', {
            blobUrl: blobUrl.substring(0, blobUrl.indexOf('?') > 0 ? blobUrl.indexOf('?') : blobUrl.length),
            imageSize: imageBuffer.length,
            method: 'Azure SDK'
          });
          
          return imageBuffer;
        } catch (azureError) {
          logger.warn('Failed to fetch using Azure SDK, falling back to HTTP fetch', { 
            error: azureError.message,
            blobUrl: blobUrl.substring(0, blobUrl.indexOf('?') > 0 ? blobUrl.indexOf('?') : blobUrl.length)
          });
          // Continue with regular fetch as fallback
        }
      }

      // Use a longer timeout to ensure large images can be fetched
      const fetchOptions = {
        timeout: 15000, // 15 second timeout
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Origin': process.env.FRONTEND_URL || 'http://localhost:3000'  // Add origin for CORS
        }
      };
      
      // Make the fetch request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      fetchOptions.signal = controller.signal;
      
      // Use fetch to get image data from blob URL
      const response = await fetch(blobUrl, fetchOptions);
      clearTimeout(timeoutId);
      
      // Detailed error handling for HTTP errors
      if (!response.ok) {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          url: blobUrl,
          headers: Object.fromEntries(response.headers.entries())
        };
        
        logger.error('Blob fetch HTTP error', errorDetails);
        throw new Error(`Failed to fetch image (HTTP ${response.status}): ${response.statusText}`);
      }
      
      // Check content type to ensure it's an image
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        logger.warn('Blob URL did not return image content type', {
          url: blobUrl,
          contentType
        });
      }
      
      // Convert response to buffer
      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);
      
      // Validate we got actual image data
      if (imageBuffer.length === 0) {
        logger.error('Empty image buffer returned from blob URL', { blobUrl });
        throw new Error('Empty image received from blob storage');
      }
      
      // Basic image header validation (check for common image formats)
      const isJpeg = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8;
      const isPng = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47;
      const isValid = isJpeg || isPng || imageBuffer.length > 1000; // Assume valid if size is reasonable
      
      if (!isValid) {
        logger.warn('Image from blob may not be a valid image format', {
          blobUrl,
          bufferLength: imageBuffer.length,
          firstBytes: imageBuffer.slice(0, 8).toString('hex')
        });
      }
      
      logger.info('Successfully fetched image from blob storage', {
        blobUrl: blobUrl,
        imageSize: imageBuffer.length,
        contentType,
        method: 'HTTP fetch'
      });
      
      return imageBuffer;
      
    } catch (error) {
      // Enhanced error logging with additional context
      const errorContext = {
        blobUrl,
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
        isAbortError: error.name === 'AbortError',
        isFetchError: error instanceof TypeError && error.message.includes('fetch'),
        timestamp: new Date().toISOString()
      };
      
      logger.error('Failed to fetch image from blob URL', errorContext);
      
      // Try to get fallback image if available
      try {
        // If we can't fetch the image, send a minimal placeholder image
        // This helps GPT-4.1 continue processing rather than failing completely
        logger.info('Generating fallback image placeholder');
        const placeholderSvg = Buffer.from(`<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="#f0f0f0"/>
          <text x="10" y="50" font-family="Arial" font-size="12">Image Error</text>
          <text x="10" y="70" font-family="Arial" font-size="8">${error.message.substring(0, 30)}</text>
        </svg>`);
        
        logger.warn('Using placeholder image due to fetch error', { 
          originalUrl: blobUrl,
          reason: error.message
        });
        
        return placeholderSvg;
      } catch (fallbackError) {
        // If even the fallback fails, we have to throw the original error
        if (error.name === 'AbortError') {
          throw new Error('Image fetch timed out. The blob storage may be slow or unavailable.');
        } else {
          throw new Error(`Failed to fetch image from blob storage: ${error.message}`);
        }
      }
    }
  }

  async analyzeImageSafety(imageBuffer, prompt) {
    this.ensureClientsInitialized();
    try {
      logger.info('Starting comprehensive image safety analysis with GPT-4.1 Vision + Azure Computer Vision');
      
      // Convert buffer to base64 for GPT-4.1 Vision
      const base64Image = imageBuffer.toString('base64');
      const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
      
      // Enhanced safety analysis prompt with Georgia-Pacific 2025 SML compliance
      const enhancedPrompt = `${prompt}

CRITICAL SAFETY ANALYSIS INSTRUCTIONS:
You are performing Georgia-Pacific 2025 SML (Safety Management Lifecycle) compliance analysis. Apply these standards exactly:

**WORK CATEGORIES (identify all that apply):**
1. Working from Heights (>6 feet)
2. Hot Work (welding, cutting, grinding)
3. Confined Space Entry
4. Electrical Work
5. Lifting & Rigging Operations
6. Line Break Operations
7. Excavation Work
8. Mobile Equipment Operations
9. Chemical Handling
10. Emergency Response

**CRITICAL HAZARDS (flag immediately):**
1. Fall hazards without proper protection
2. Fire/explosion risks
3. Toxic exposure
4. Electrical shock hazards
5. Struck-by hazards

**ANALYSIS REQUIREMENTS:**
- Severity × Probability risk ranking (1-5 scale each)
- Hierarchy of controls (Elimination > Substitution > Engineering > Administrative > PPE)
- Both Prevention AND Recovery controls
- Communication urgency (STOP for critical, HIGH RISK for serious)
- SML permit verification
- OSHA compliance check

Provide detailed, actionable safety analysis with specific control measures.`;

      // Call GPT-4.1 Vision for comprehensive analysis
      const visionResponse = await this.openaiClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME, // GPT-4.1 Vision
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: enhancedPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl,
                  detail: 'high' // High detail for maximum accuracy
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1 // Low temperature for consistent safety analysis
      });

      const visionAnalysis = visionResponse.choices[0].message.content;
      
      // Enhanced result structure for safety analysis
      const analysisResult = {
        safety_analysis: visionAnalysis,
        image_metadata: {
          size_bytes: imageBuffer.length,
          analysis_timestamp: new Date().toISOString(),
          model_used: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
          analysis_type: 'comprehensive_safety_vision'
        },
        compliance_framework: 'Georgia-Pacific_2025_SML',
        confidence_level: 'high_detail_vision_analysis'
      };
      
      logger.info('Image safety analysis completed successfully', {
        analysisLength: visionAnalysis.length,
        imageSize: imageBuffer.length,
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
        complianceFramework: 'Georgia-Pacific_2025_SML'
      });
      
      return analysisResult;
      
    } catch (error) {
      logger.error('GPT-4.1 Vision image analysis failed:', error);
      
      // Fallback error response
      return {
        safety_analysis: `Image analysis encountered an error: ${error.message}. Please ensure the image is clear and contains visible safety elements for analysis.`,
        image_metadata: {
          size_bytes: imageBuffer ? imageBuffer.length : 0,
          analysis_timestamp: new Date().toISOString(),
          error: error.message,
          analysis_type: 'error_fallback'
        },
        compliance_framework: 'Georgia-Pacific_2025_SML',
        confidence_level: 'error_state'
      };
    }
  }

  analyzeSafetyFlags(response) {
    const flags = [];
    const responseUpper = response.toUpperCase();

    // Critical safety indicators
    const criticalPatterns = [
      'STOP WORK',
      'CRITICAL',
      'IMMEDIATE DANGER',
      'HIGH RISK',
      'LIFE THREATENING',
      'FATAL',
      'EMERGENCY'
    ];

    const moderatePatterns = [
      'MODERATE RISK',
      'CAUTION',
      'WARNING',
      'POTENTIAL HAZARD',
      'SAFETY CONCERN'
    ];

    // Check for critical flags
    criticalPatterns.forEach(pattern => {
      if (responseUpper.includes(pattern)) {
        flags.push({
          level: 'CRITICAL',
          type: 'safety_alert',
          pattern: pattern,
          requires_immediate_action: true
        });
      }
    });

    // Check for moderate flags
    moderatePatterns.forEach(pattern => {
      if (responseUpper.includes(pattern)) {
        flags.push({
          level: 'MODERATE',
          type: 'safety_concern',
          pattern: pattern,
          requires_immediate_action: false
        });
      }
    });

    // Detect SML categories
    const smlCategories = [
      'WORKING FROM HEIGHTS',
      'HOT WORK',
      'CONFINED SPACE',
      'ELECTRICAL',
      'LIFTING & RIGGING',
      'LINE BREAK',
      'EXCAVATION',
      'MOBILE EQUIPMENT'
    ];

    smlCategories.forEach(category => {
      if (responseUpper.includes(category)) {
        flags.push({
          level: 'INFO',
          type: 'sml_category',
          pattern: category,
          requires_immediate_action: false
        });
      }
    });

    return flags;
  }

  async generateEmbedding(text) {
    this.ensureClientsInitialized();
    try {
      // Use Azure OpenAI embeddings instead of Cohere
      const response = await this.embeddingClient.embeddings.create({
        model: 'embed-v-4-0-2', // or 'text-embedding-3-small' if available
        input: text,
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Azure OpenAI embedding generation failed:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async analyzeImageWithEnhancedSafety(imageBuffer, fileName = 'uploaded_image') {
    try {
      logger.info('Starting enhanced safety analysis with memory and reasoning...');
      
      // Use the enhanced safety service for comprehensive analysis
      const enhancedAnalysis = await enhancedSafetyService.analyzeWithEnhancedSafety(imageBuffer, fileName);
      
      // Convert to chat service format while preserving enhanced features
      return {
        safety_analysis: {
          risk_level: enhancedAnalysis.overall_risk_level,
          risk_score: enhancedAnalysis.risk_score,
          confidence_level: enhancedAnalysis.confidence_level,
          stop_work_required: enhancedAnalysis.stop_work_required,
          stop_work_reasoning: enhancedAnalysis.stop_work_reasoning,
          hazards: enhancedAnalysis.hazards || [],
          sml_categories: enhancedAnalysis.sml_categories || [],
          immediate_actions: enhancedAnalysis.immediate_actions || [],
          recommendations: enhancedAnalysis.recommendations || [],
          analysis_reasoning: enhancedAnalysis.analysis_reasoning,
          confidence_reasoning: enhancedAnalysis.confidence_reasoning,
          uncertainty_factors: enhancedAnalysis.uncertainty_factors || [],
          memory_validation: enhancedAnalysis.memory_validation,
          analysis_timestamp: enhancedAnalysis.analysis_timestamp,
          analysis_version: enhancedAnalysis.analysis_version
        },
        // Generate formatted response for chat
        formatted_response: this.formatEnhancedSafetyResponse(enhancedAnalysis)
        // UI flags removed - using formatted response instead
      };
      
    } catch (error) {
      logger.error('Enhanced safety analysis failed:', error);
      throw new Error(`Enhanced safety analysis failed: ${error.message}`);
    }
  }

  formatEnhancedSafetyResponse(analysis) {
    let response = '';
    
    // Critical stop work alert
    if (analysis.stop_work_required) {
      response += `🚨 **STOP WORK IMMEDIATELY** 🚨\n\n`;
      response += `**CRITICAL SAFETY ALERT**\n`;
      response += `${analysis.stop_work_reasoning}\n\n`;
    }
    
    // Risk assessment
    response += `## Safety Analysis Results\n\n`;
    response += `**Overall Risk Level:** ${analysis.overall_risk_level}\n`;
    response += `**Risk Score:** ${analysis.risk_score}/10\n`;
    response += `**Confidence Level:** ${analysis.confidence_level}%\n\n`;
    
    // Hazards detected
    if (analysis.hazards && analysis.hazards.length > 0) {
      response += `## Hazards Identified\n\n`;
      analysis.hazards.forEach((hazard, index) => {
        const emoji = hazard.severity === 'Critical' ? '🔴' : 
                     hazard.severity === 'High' ? '🟠' : 
                     hazard.severity === 'Medium' ? '🟡' : '🟢';
        
        response += `${emoji} **${hazard.type}** (${hazard.severity} Risk)\n`;
        response += `   - ${hazard.description}\n`;
        response += `   - Location: ${hazard.location || 'General area'}\n`;
        response += `   - Confidence: ${hazard.confidence}%\n`;
        if (hazard.evidence) {
          response += `   - Evidence: ${hazard.evidence}\n`;
        }
        response += `\n`;
      });
    }
    
    // Immediate actions
    if (analysis.immediate_actions && analysis.immediate_actions.length > 0) {
      response += `## Immediate Actions Required\n\n`;
      analysis.immediate_actions.forEach((action, index) => {
        response += `${index + 1}. ${action}\n`;
      });
      response += `\n`;
    }
    
    // Recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      response += `## Safety Recommendations\n\n`;
      analysis.recommendations.forEach((rec, index) => {
        response += `• ${rec}\n`;
      });
      response += `\n`;
    }
    
    // Reasoning and transparency
    if (analysis.analysis_reasoning) {
      response += `## Analysis Reasoning\n\n`;
      response += `${analysis.analysis_reasoning}\n\n`;
    }
    
    // Confidence factors
    if (analysis.uncertainty_factors && analysis.uncertainty_factors.length > 0) {
      response += `## Areas of Uncertainty\n\n`;
      analysis.uncertainty_factors.forEach(factor => {
        response += `⚠️ ${factor}\n`;
      });
      response += `\n`;
    }
    
    // Memory integration info
    if (analysis.memory_validation && analysis.memory_validation.similar_analyses) {
      const similarCount = analysis.memory_validation.similar_analyses.length;
      if (similarCount > 0) {
        response += `## Experience Integration\n\n`;
        response += `📚 This analysis draws from ${similarCount} similar workplace scenarios in our safety database.\n`;
        response += `🧠 Memory confidence: ${analysis.memory_validation.memory_confidence}%\n\n`;
      }
    }
    
    response += `---\n`;
    response += `*Analysis completed with Enhanced AI Safety System v${analysis.analysis_version || '2.0'}*\n`;
    response += `*Timestamp: ${analysis.analysis_timestamp}*`;
    
    return response;
  }

  convertToSafetyFlags(analysis) {
    const flags = [];
    
    // Critical stop work flag
    if (analysis.stop_work_required) {
      flags.push({
        level: 'CRITICAL',
        type: 'stop_work',
        message: 'STOP WORK REQUIRED',
        requires_immediate_action: true,
        confidence: analysis.confidence_level
      });
    }
    
    // Risk level flags
    if (analysis.overall_risk_level === 'HIGH_RISK' || analysis.overall_risk_level === 'CRITICAL_STOP') {
      flags.push({
        level: 'HIGH',
        type: 'risk_assessment',
        message: `High risk conditions detected: ${analysis.overall_risk_level}`,
        requires_immediate_action: analysis.overall_risk_level === 'CRITICAL_STOP',
        confidence: analysis.confidence_level
      });
    }
    
    // Individual hazard flags
    if (analysis.hazards) {
      analysis.hazards.forEach(hazard => {
        if (hazard.severity === 'Critical' || hazard.severity === 'High') {
          flags.push({
            level: hazard.severity.toUpperCase(),
            type: 'hazard_detection',
            message: `${hazard.type}: ${hazard.description}`,
            requires_immediate_action: hazard.severity === 'Critical',
            confidence: hazard.confidence
          });
        }
      });
    }
    
    return flags;
  }

}

// Create singleton instance
const chatService = new ChatService();

module.exports = chatService;
