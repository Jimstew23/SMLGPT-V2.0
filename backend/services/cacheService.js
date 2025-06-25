const NodeCache = require('node-cache');
const crypto = require('crypto');
const logger = require('../utils/logger');

class CacheService {
    constructor() {
        // Analysis cache with 1 hour TTL
        this.analysisCache = new NodeCache({ 
            stdTTL: 3600,
            checkperiod: 600,
            useClones: false,
            maxKeys: 100
        });
        
        // Image hash cache with 2 hour TTL
        this.imageHashCache = new NodeCache({ 
            stdTTL: 7200,
            checkperiod: 600,
            maxKeys: 200
        });
        
        // Track cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            saves: 0
        };
        
        logger.info('Cache service initialized', {
            analysisCacheTTL: '1 hour',
            hashCacheTTL: '2 hours'
        });
    }

    generateImageHash(buffer) {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        return hash.substring(0, 16); // Use first 16 chars for shorter keys
    }

    async getCachedAnalysis(imageHash) {
        const cached = this.analysisCache.get(imageHash);
        if (cached) {
            this.stats.hits++;
            logger.info('Cache HIT for image analysis', { 
                imageHash,
                cacheStats: this.stats 
            });
            return cached;
        }
        this.stats.misses++;
        return null;
    }

    cacheAnalysis(imageHash, analysis) {
        try {
            this.analysisCache.set(imageHash, analysis);
            this.stats.saves++;
            logger.info('Cached analysis for image', { 
                imageHash,
                analysisSize: JSON.stringify(analysis).length,
                cacheStats: this.stats
            });
        } catch (error) {
            logger.error('Failed to cache analysis', { error: error.message });
        }
    }

    cacheImageHash(filename, hash) {
        this.imageHashCache.set(filename, hash);
    }

    getCachedImageHash(filename) {
        return this.imageHashCache.get(filename);
    }

    // Get cache performance metrics
    getStats() {
        const analysisCacheStats = this.analysisCache.getStats();
        const hashCacheStats = this.imageHashCache.getStats();
        
        return {
            analysisCache: {
                keys: this.analysisCache.keys().length,
                hits: analysisCacheStats.hits,
                misses: analysisCacheStats.misses,
                hitRate: analysisCacheStats.hits / (analysisCacheStats.hits + analysisCacheStats.misses) || 0
            },
            hashCache: {
                keys: this.imageHashCache.keys().length
            },
            customStats: this.stats,
            memoryUsage: process.memoryUsage()
        };
    }

    // Clear all caches
    clearAll() {
        this.analysisCache.flushAll();
        this.imageHashCache.flushAll();
        this.stats = { hits: 0, misses: 0, saves: 0 };
        logger.info('All caches cleared');
    }

    // Check if image was recently analyzed
    isRecentlyAnalyzed(imageHash, maxAgeMs = 300000) { // 5 minutes
        const cached = this.analysisCache.get(imageHash);
        if (!cached) return false;
        
        const age = Date.now() - (cached.timestamp || 0);
        return age < maxAgeMs;
    }
}

// Create singleton instance
const cacheService = new CacheService();

// Log cache stats every 5 minutes
setInterval(() => {
    const stats = cacheService.getStats();
    logger.info('Cache statistics', stats);
}, 300000);

module.exports = cacheService;
