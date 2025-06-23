const logger = require('../utils/logger');

/**
 * Simple in-memory document store for managing uploaded file content
 * In production, this would be replaced with a database or persistent storage
 */
class DocumentStore {
  constructor() {
    this.documents = new Map(); // documentId -> document data
    this.userDocuments = new Map(); // userId -> Set of documentIds
  }

  /**
   * Store document content and metadata
   */
  storeDocument(documentId, data) {
    try {
      const document = {
        id: documentId,
        filename: data.filename,
        content: data.content || data.extractedText,
        contentType: data.contentType,
        uploadedAt: new Date().toISOString(),
        userId: data.userId || 'default',
        size: data.size,
        blobUrl: data.metadata?.blobUrl || data.blobUrl, // Extract blobUrl from metadata or direct property
        metadata: data.metadata || {}
      };

      this.documents.set(documentId, document);

      // Track user documents
      const userId = document.userId;
      if (!this.userDocuments.has(userId)) {
        this.userDocuments.set(userId, new Set());
      }
      this.userDocuments.get(userId).add(documentId);

      logger.info('Document stored successfully', {
        documentId,
        filename: document.filename,
        userId,
        contentLength: document.content?.length || 0
      });

      return document;
    } catch (error) {
      logger.error('Failed to store document', { documentId, error: error.message });
      throw error;
    }
  }

  /**
   * Retrieve document by ID
   */
  getDocument(documentId) {
    return this.documents.get(documentId);
  }

  /**
   * Get multiple documents by IDs
   */
  getDocuments(documentIds) {
    return documentIds
      .map(id => this.documents.get(id))
      .filter(doc => doc !== undefined);
  }

  /**
   * Get all documents for a user
   */
  getUserDocuments(userId = 'default') {
    const userDocIds = this.userDocuments.get(userId);
    if (!userDocIds) return [];

    return Array.from(userDocIds)
      .map(id => this.documents.get(id))
      .filter(doc => doc !== undefined);
  }

  /**
   * Delete document
   */
  deleteDocument(documentId) {
    const document = this.documents.get(documentId);
    if (!document) return false;

    this.documents.delete(documentId);
    
    // Remove from user tracking
    const userId = document.userId;
    const userDocs = this.userDocuments.get(userId);
    if (userDocs) {
      userDocs.delete(documentId);
      if (userDocs.size === 0) {
        this.userDocuments.delete(userId);
      }
    }

    logger.info('Document deleted', { documentId, userId });
    return true;
  }

  /**
   * Get document summary for context building
   */
  getDocumentSummary(documentId) {
    const document = this.getDocument(documentId);
    if (!document) return null;

    return {
      id: documentId,
      filename: document.filename,
      contentType: document.contentType,
      contentPreview: document.content ? 
        document.content.substring(0, 200) + (document.content.length > 200 ? '...' : '') : 
        'No content available',
      uploadedAt: document.uploadedAt,
      size: document.size
    };
  }

  /**
   * Build context string from document content
   */
  buildContextFromDocuments(documentIds) {
    const documents = this.getDocuments(documentIds);
    if (documents.length === 0) return '';

    return documents.map(doc => {
      const preview = doc.content || 'No content available';
      return `[Document: ${doc.filename}]\n${preview}\n`;
    }).join('\n---\n');
  }

  /**
   * Get store statistics
   */
  getStats() {
    return {
      totalDocuments: this.documents.size,
      totalUsers: this.userDocuments.size,
      documentsPerUser: Array.from(this.userDocuments.entries()).map(([userId, docs]) => ({
        userId,
        documentCount: docs.size
      }))
    };
  }

  /**
   * Get all documents (for debugging and testing)
   */
  getAllDocuments() {
    return Array.from(this.documents.values());
  }

  /**
   * Clear all documents (for testing)
   */
  clearAll() {
    this.documents.clear();
    this.userDocuments.clear();
    logger.info('Document store cleared');
  }
}

// Create singleton instance
const documentStore = new DocumentStore();

module.exports = documentStore;
