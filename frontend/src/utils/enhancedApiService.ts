/**
 * Enhanced API Service for SMLGPT V2.0
 * Provides enhanced API interactions for advanced safety analysis with memory and reasoning
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { SafetyAnalysis } from '../types';

// API Configuration with detailed logging
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Debug logging for API configuration
console.log('🔧 Enhanced API Service Configuration:');
console.log('- API_BASE_URL:', API_BASE_URL);
console.log('- Environment REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('- Current timestamp:', new Date().toISOString());

// Create axios instance with configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for complex AI analysis
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log('📤 Making API Request:', {
      url: config.url,
      baseURL: config.baseURL,
      method: config.method,
      headers: config.headers,
      timeout: config.timeout
    });
    return config;
  },
  (error) => {
    console.error('❌ Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response Success:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url
    });
    return response;
  },
  (error: AxiosError) => {
    console.error('❌ API Response Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullUrl: `${error.config?.baseURL}${error.config?.url}`,
      isTimeout: error.code === 'ECONNABORTED',
      isNetworkError: error.message === 'Network Error',
      errorType: error.name,
      stack: error.stack
    });
    
    // Enhanced error logging for network issues
    if (error.message === 'Network Error') {
      console.error('🚨 NETWORK ERROR DETAILS:', {
        apiBaseUrl: API_BASE_URL,
        requestUrl: error.config?.url,
        fullRequestUrl: `${API_BASE_URL}${error.config?.url}`,
        headers: error.config?.headers,
        method: error.config?.method,
        timestamp: new Date().toISOString(),
        errorCode: error.code,
        possibleCauses: [
          'Backend server not running',
          'CORS configuration issue',
          'Port mismatch',
          'Firewall blocking request',
          'Invalid endpoint URL'
        ]
      });
    }
    
    return Promise.reject(error);
  }
);

// Enhanced API response interface
interface EnhancedSafetyResponse {
  safety_analysis: SafetyAnalysis;
  formatted_response: string;
  safety_flags: Array<{
    level: string;
    type: string;
    message: string;
    requires_immediate_action: boolean;
    confidence: number;
  }>;
  additional_context?: string;
}

// Error interface for better error handling
interface ApiError {
  message: string;
  type?: string;
  stack?: string;
}

/**
 * Enhanced Safety Analysis Service
 */
export class EnhancedApiService {
  /**
   * Perform enhanced safety analysis with memory and reasoning
   */
  static async analyzeImageWithEnhancedSafety(
    imageFile: File,
    additionalContext: string = ''
  ): Promise<EnhancedSafetyResponse> {
    try {
      console.log('Starting enhanced safety analysis...');
      
      // Prepare form data
      const formData = new FormData();
      formData.append('image', imageFile);
      
      if (additionalContext) {
        formData.append('additional_context', additionalContext);
      }
      
      // Log request details
      console.log('Enhanced analysis request:', {
        fileName: imageFile.name,
        fileSize: imageFile.size,
        fileType: imageFile.type,
        hasContext: !!additionalContext
      });
      
      // Make API request
      const response: AxiosResponse<EnhancedSafetyResponse> = await apiClient.post(
        '/api/safety/analyze-enhanced',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              console.log(`Upload progress: ${percentCompleted}%`);
            }
          },
        }
      );
      
      // Log successful response
      console.log('Enhanced safety analysis completed:', {
        riskLevel: response.data.safety_analysis.risk_level,
        confidenceLevel: response.data.safety_analysis.confidence_level,
        stopWorkRequired: response.data.safety_analysis.stop_work_required,
        hazardsCount: response.data.safety_analysis.hazards?.length || 0,
        flagsCount: response.data.safety_flags?.length || 0
      });
      
      return response.data;
      
    } catch (error: any) {
      console.error('Enhanced safety analysis failed:', error);
      
      if (axios.isAxiosError(error)) {
        const apiError: ApiError = {
          message: error.response?.data?.error || error.message,
          type: error.response?.data?.type || 'api_error',
          stack: error.response?.data?.stack
        };
        
        throw new Error(`Enhanced safety analysis failed: ${apiError.message}`);
      }
      
      throw new Error(`Enhanced safety analysis failed: ${error.message}`);
    }
  }
  
  /**
   * Check API health and enhanced features availability
   */
  static async checkEnhancedFeaturesHealth(): Promise<{
    status: string;
    enhancedFeaturesAvailable: boolean;
    memorySystemActive: boolean;
    reasoningEngineActive: boolean;
  }> {
    try {
      const response = await apiClient.get('/api/health');
      
      // Check if enhanced features are available by testing the endpoint
      const enhancedResponse = await apiClient.get('/api/safety/analyze-enhanced', {
        validateStatus: (status) => status === 400 || status === 200 // 400 is expected without file
      });
      
      return {
        status: response.data.status,
        enhancedFeaturesAvailable: enhancedResponse.status === 400, // 400 means endpoint exists but needs file
        memorySystemActive: true, // Assume active if endpoint is available
        reasoningEngineActive: true // Assume active if endpoint is available
      };
      
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        enhancedFeaturesAvailable: false,
        memorySystemActive: false,
        reasoningEngineActive: false
      };
    }
  }
  
  /**
   * Get memory statistics (if available)
   */
  static async getMemoryStatistics(): Promise<{
    totalAnalyses: number;
    memoryDatabaseSize: number;
    lastUpdated: string;
  } | null> {
    try {
      // This would be implemented if backend provides memory stats endpoint
      // For now, return null as the endpoint doesn't exist yet
      return null;
      
    } catch (error) {
      console.error('Failed to get memory statistics:', error);
      return null;
    }
  }
  
  /**
   * Validate image file before analysis
   */
  static validateImageFile(file: File): string[] {
    const errors: string[] = [];
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      errors.push('Invalid file type. Please upload JPEG, PNG, or WebP images.');
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      errors.push('File size too large. Maximum size is 10MB.');
    }
    
    // Check minimum size (at least 1KB)
    const minSize = 1024; // 1KB
    if (file.size < minSize) {
      errors.push('File size too small. Minimum size is 1KB.');
    }
    
    return errors;
  }
  
  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Get analysis progress messages
   */
  static getAnalysisProgressMessages(): string[] {
    return [
      'Initializing AI analysis engine...',
      'Loading safety memory database...',
      'Analyzing image for hazards...',
      'Cross-validating with past experiences...',
      'Performing reasoning validation...',
      'Calculating confidence scores...',
      'Evaluating stop-work conditions...',
      'Generating recommendations...',
      'Finalizing safety assessment...'
    ];
  }
  
  /**
   * Create a delay for progress simulation
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Simulate analysis progress for UI feedback
   */
  static async simulateAnalysisProgress(
    onProgress: (message: string, progress: number) => void
  ): Promise<void> {
    const messages = this.getAnalysisProgressMessages();
    const totalSteps = messages.length;
    
    for (let i = 0; i < totalSteps; i++) {
      const progress = Math.round((i / totalSteps) * 100);
      onProgress(messages[i], progress);
      
      // Variable delay based on step complexity
      const delays = [500, 800, 2000, 1500, 1200, 800, 1000, 800, 600];
      await this.delay(delays[i] || 500);
    }
    
    onProgress('Analysis complete!', 100);
  }
}

// Export singleton instance
export default EnhancedApiService;
