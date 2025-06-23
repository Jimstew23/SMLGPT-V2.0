const azureServices = require('./azureServices');
const logger = require('../utils/logger');

class SearchService {
  constructor() {
    this.defaultSearchOptions = {
      top: 10,
      skip: 0,
      includeTotalCount: true,
      searchMode: 'any',
      queryType: 'simple'
    };
  }

  async searchDocuments({ query, top = 10, skip = 0, filters = {}, include_embeddings = false }) {
    try {
      const startTime = Date.now();
      
      const searchOptions = {
        ...this.defaultSearchOptions,
        top,
        skip,
        searchFields: ['title', 'content'],
        highlight: ['title', 'content'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>'
      };

      // Apply filters
      const filterExpressions = [];
      
      if (filters.file_type) {
        filterExpressions.push(`file_type eq '${filters.file_type}'`);
      }
      
      if (filterExpressions.length > 0) {
        searchOptions.filter = filterExpressions.join(' and ');
      }

      // Perform the search
      const searchResults = await azureServices.searchDocuments(query, searchOptions);
      
      const duration = Date.now() - startTime;
      
      logger.info('Document search completed', {
        query: query.substring(0, 100),
        resultCount: searchResults.results.length,
        totalCount: searchResults.totalCount,
        duration: `${duration}ms`,
        filters: Object.keys(filters).length > 0 ? filters : 'none'
      });

      // Process results to include highlights and relevance scoring
      const processedResults = searchResults.results.map(result => ({
        ...result,
        relevance_score: result.score,
        highlights: result.highlights || {},
      }));

      return {
        results: processedResults,
        total_count: searchResults.totalCount,
        query,
        search_time_ms: duration,
        has_more: (skip + top) < searchResults.totalCount,
        facets: await this.getFacets(query, filters)
      };

    } catch (error) {
      logger.error('Document search failed:', error);
      throw new Error(`Document search failed: ${error.message}`);
    }
  }

  async vectorSearch({ query_embedding, top = 10, similarity_threshold = 0.7 }) {
    try {
      const startTime = Date.now();
      
      const searchOptions = {
        vectorQueries: [{
          vector: query_embedding,
          kNearestNeighborsCount: top * 2, // Get more for filtering
          fields: 'embedding'
        }],
        select: ['id', 'title', 'content', 'file_type'],
        top: top * 2 // Allow for similarity filtering
      };

      const searchResults = await azureServices.searchClient.search('*', searchOptions);
      
      const results = [];
      for await (const result of searchResults.results) {
        // Filter by similarity threshold
        if (result.score >= similarity_threshold) {
          results.push({
            document: result.document,
            similarity_score: result.score,
            relevance_score: result.score
          });
        }
        
        // Stop when we have enough results
        if (results.length >= top) break;
      }

      const duration = Date.now() - startTime;
      
      logger.info('Vector search completed', {
        resultCount: results.length,
        similarityThreshold: similarity_threshold,
        duration: `${duration}ms`
      });

      return {
        results,
        search_time_ms: duration,
        similarity_threshold
      };

    } catch (error) {
      logger.error('Vector search failed:', error);
      throw new Error(`Vector search failed: ${error.message}`);
    }
  }

  async hybridSearch({ text_query, query_embedding, top = 10, text_weight = 0.5, vector_weight = 0.5 }) {
    try {
      const startTime = Date.now();
      
      // Perform both text and vector search
      const [textResults, vectorResults] = await Promise.all([
        this.searchDocuments({ query: text_query, top: top * 2 }),
        this.vectorSearch({ query_embedding, top: top * 2, similarity_threshold: 0.6 })
      ]);

      // Combine and rank results
      const combinedResults = this.combineSearchResults(
        textResults.results,
        vectorResults.results,
        text_weight,
        vector_weight
      );

      // Take top results
      const finalResults = combinedResults.slice(0, top);
      const duration = Date.now() - startTime;

      logger.info('Hybrid search completed', {
        textQuery: text_query.substring(0, 100),
        textResults: textResults.results.length,
        vectorResults: vectorResults.results.length,
        finalResults: finalResults.length,
        duration: `${duration}ms`
      });

      return {
        results: finalResults,
        search_time_ms: duration,
        text_weight,
        vector_weight,
        component_results: {
          text_count: textResults.results.length,
          vector_count: vectorResults.results.length
        }
      };

    } catch (error) {
      logger.error('Hybrid search failed:', error);
      throw new Error(`Hybrid search failed: ${error.message}`);
    }
  }

  async getDocument(documentId) {
    try {
      const result = await azureServices.searchClient.getDocument(documentId);
      
      logger.info('Document retrieved', { documentId });
      
      return result;

    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      logger.error('Failed to get document:', error);
      throw new Error(`Failed to get document: ${error.message}`);
    }
  }

  async indexDocument(document) {
    try {
      // Validate required fields
      if (!document.id) {
        throw new Error('Document must have an id field');
      }

      // Index the document
      const result = await azureServices.indexDocument(document);
      
      logger.info('Document indexed', { 
        documentId: document.id,
        success: result.succeeded 
      });

      return result;

    } catch (error) {
      logger.error('Document indexing failed:', error);
      throw new Error(`Document indexing failed: ${error.message}`);
    }
  }

  async deleteDocument(documentId) {
    try {
      const result = await azureServices.searchClient.deleteDocuments([{ id: documentId }]);
      
      logger.info('Document deleted', { 
        documentId,
        success: result.results[0].succeeded 
      });

      return result.results[0];

    } catch (error) {
      logger.error('Document deletion failed:', error);
      throw new Error(`Document deletion failed: ${error.message}`);
    }
  }

  async getFacets(query = '*', filters = {}) {
    try {
      const searchOptions = {
        facets: [
          'file_type,count:10'
        ],
        top: 0 // We only want facets, not results
      };

      // Apply existing filters for facet calculation
      const filterExpressions = [];
      Object.keys(filters).forEach(key => {
        if (filters[key] && key !== 'facet_field') {
          filterExpressions.push(`${key} eq '${filters[key]}'`);
        }
      });

      if (filterExpressions.length > 0) {
        searchOptions.filter = filterExpressions.join(' and ');
      }

      const searchResults = await azureServices.searchDocuments(query, searchOptions);
      
      return searchResults.facets || {};

    } catch (error) {
      logger.error('Failed to get facets:', error);
      return {};
    }
  }

  async getSuggestions(partialQuery, suggesterName = 'sg') {
    try {
      const suggestions = await azureServices.searchClient.suggest(partialQuery, suggesterName, {
        top: 10,
        useFuzzyMatching: true,
        highlightPreTag: '<b>',
        highlightPostTag: '</b>'
      });

      return suggestions.results.map(result => ({
        text: result.text,
        document: result.document
      }));

    } catch (error) {
      logger.error('Failed to get suggestions:', error);
      return [];
    }
  }

  async getSearchStatistics() {
    try {
      const stats = await azureServices.searchIndexClient.getSearchIndexStatistics(
        process.env.AZURE_SEARCH_INDEX_NAME
      );

      return {
        document_count: stats.documentCount,
        storage_size_bytes: stats.storageSize,
        index_name: process.env.AZURE_SEARCH_INDEX_NAME
      };

    } catch (error) {
      logger.error('Failed to get search statistics:', error);
      return {
        document_count: 0,
        storage_size_bytes: 0,
        index_name: process.env.AZURE_SEARCH_INDEX_NAME
      };
    }
  }

  // Helper methods
  combineSearchResults(textResults, vectorResults, textWeight, vectorWeight) {
    const scoreMap = new Map();
    
    // Process text results
    textResults.forEach(result => {
      const docId = result.document.id;
      scoreMap.set(docId, {
        document: result.document,
        text_score: result.relevance_score || result.score || 0,
        vector_score: 0,
        combined_score: 0
      });
    });

    // Process vector results
    vectorResults.forEach(result => {
      const docId = result.document.id;
      if (scoreMap.has(docId)) {
        scoreMap.get(docId).vector_score = result.similarity_score || 0;
      } else {
        scoreMap.set(docId, {
          document: result.document,
          text_score: 0,
          vector_score: result.similarity_score || 0,
          combined_score: 0
        });
      }
    });

    // Calculate combined scores and sort
    const combinedResults = Array.from(scoreMap.values()).map(item => {
      item.combined_score = (item.text_score * textWeight) + (item.vector_score * vectorWeight);
      return item;
    });

    return combinedResults.sort((a, b) => b.combined_score - a.combined_score);
  }

  generateSummary(content, maxLength = 200) {
    if (!content || content.length <= maxLength) {
      return content || '';
    }
    
    // Find the last complete sentence within the limit
    const truncated = content.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }
    
    return truncated + '...';
  }
}

// Create singleton instance
const searchService = new SearchService();

module.exports = searchService;
