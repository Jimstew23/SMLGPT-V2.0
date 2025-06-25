interface CachedFile {
    id: string;
    filename: string;
    url: string;
    analysis: any;
    timestamp: number;
    hash?: string;
}

interface CachedAnalysis {
    data: any;
    timestamp: number;
}

class CacheService {
    private fileCache = new Map<string, CachedFile>();
    private analysisCache = new Map<string, CachedAnalysis>();
    private maxCacheSize = 50; // Max files to cache
    private cacheExpiryMs = 3600000; // 1 hour
    private storageKey = 'smlgpt_cache';

    constructor() {
        // Load cache from localStorage on init
        this.loadFromStorage();
        
        // Clean expired entries every 5 minutes
        setInterval(() => this.clearExpiredCache(), 300000);
    }

    cacheFile(fileId: string, data: CachedFile) {
        // Implement LRU cache
        if (this.fileCache.size >= this.maxCacheSize) {
            const firstKey = this.fileCache.keys().next().value;
            this.fileCache.delete(firstKey);
        }
        this.fileCache.set(fileId, data);
        this.saveToStorage();
    }

    getCachedFile(fileId: string): CachedFile | null {
        const cached = this.fileCache.get(fileId);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
            console.log(`Cache hit for file: ${fileId}`);
            return cached;
        }
        if (cached) {
            this.fileCache.delete(fileId);
            this.saveToStorage();
        }
        return null;
    }

    cacheAnalysis(imageHash: string, analysis: any) {
        this.analysisCache.set(imageHash, {
            data: analysis,
            timestamp: Date.now()
        });
        this.saveToStorage();
        console.log(`Cached analysis for image hash: ${imageHash}`);
    }

    getCachedAnalysis(imageHash: string): any | null {
        const cached = this.analysisCache.get(imageHash);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
            console.log(`Cache hit for analysis: ${imageHash}`);
            return cached.data;
        }
        if (cached) {
            this.analysisCache.delete(imageHash);
            this.saveToStorage();
        }
        return null;
    }

    // Generate hash for image deduplication
    async generateImageHash(file: File): Promise<string> {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    clearExpiredCache() {
        const now = Date.now();
        let cleared = 0;
        
        this.fileCache.forEach((value, key) => {
            if (now - value.timestamp > this.cacheExpiryMs) {
                this.fileCache.delete(key);
                cleared++;
            }
        });
        
        this.analysisCache.forEach((value, key) => {
            if (now - value.timestamp > this.cacheExpiryMs) {
                this.analysisCache.delete(key);
                cleared++;
            }
        });
        
        if (cleared > 0) {
            console.log(`Cleared ${cleared} expired cache entries`);
            this.saveToStorage();
        }
    }

    private saveToStorage() {
        try {
            const cacheData = {
                files: Array.from(this.fileCache.entries()),
                analyses: Array.from(this.analysisCache.entries())
            };
            localStorage.setItem(this.storageKey, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Failed to save cache to localStorage:', error);
        }
    }

    private loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const cacheData = JSON.parse(stored);
                this.fileCache = new Map(cacheData.files || []);
                this.analysisCache = new Map(cacheData.analyses || []);
                console.log(`Loaded ${this.fileCache.size} files and ${this.analysisCache.size} analyses from cache`);
            }
        } catch (error) {
            console.error('Failed to load cache from localStorage:', error);
        }
    }

    getStats() {
        return {
            filesCached: this.fileCache.size,
            analysesCached: this.analysisCache.size,
            maxSize: this.maxCacheSize,
            expiryHours: this.cacheExpiryMs / 3600000
        };
    }

    clearAll() {
        this.fileCache.clear();
        this.analysisCache.clear();
        localStorage.removeItem(this.storageKey);
        console.log('Cache cleared');
    }
}

export const cacheService = new CacheService();
