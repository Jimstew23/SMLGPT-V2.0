import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Message, SafetyAnalysis, SearchResult, VoiceRecording, ChatSession } from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth and logging
    this.api.interceptors.request.use(
      (config) => {
        console.log(`🔧 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        console.log('🔧 Full URL:', `${config.baseURL}${config.url}`);
        console.log('🔧 Headers:', config.headers);
        return config;
      },
      (error) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async getHealthStatus(): Promise<{ status: string; timestamp: string }> {
    const response = await this.api.get('/api/health');
    return response.data;
  }

  // Chat endpoints
  async sendChatMessage(
    message: string,
    conversationHistory: Message[] = [],
    includeContext: boolean = true,
    documentReferences: string[] = []
  ): Promise<{ response: string; analysis?: SafetyAnalysis }> {
    const response = await this.api.post('/api/chat', {
      message,
      conversation_history: conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : new Date(msg.timestamp).toISOString()
      })),
      include_context: includeContext,
      document_references: documentReferences,
      max_tokens: 2000
    });
    return response.data;
  }

  // File upload endpoints - CONSOLIDATED to eliminate duplicates
  async uploadFileWithProgress(
    file: File,
    analysisType: 'safety' | 'general' = 'safety',
    options?: {
      onUploadProgress?: (progressEvent: any) => void;
    }
  ): Promise<{
    file_id: string;
    filename: string;
    stored_filename: string;
    file_type: string;
    mime_type: string;
    file_size: number;
    blob_url: string;
    uploaded_at: string;
    processing_time_ms: number;
    analysis: any;
    indexed: boolean;
    status: string;
    safety_analysis?: SafetyAnalysis;
    upload_info?: any;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('analysis_type', analysisType);

    const response = await this.api.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: options?.onUploadProgress,
      timeout: 120000, // 2 minutes for large files
    });
    
    return response.data;
  }

  // Backward compatibility alias - eliminates duplicate function
  async uploadFile(
    file: File,
    analysisType: 'safety' | 'general' = 'safety'
  ) {
    return this.uploadFileWithProgress(file, analysisType);
  }

  // Search endpoints
  async searchDocuments(
    query: string,
    options: {
      top?: number;
      skip?: number;
      filters?: { [key: string]: any };
      include_embeddings?: boolean;
    } = {}
  ): Promise<{
    results: SearchResult[];
    total_count: number;
    search_time_ms: number;
    has_more: boolean;
  }> {
    const response = await this.api.post('/api/search', {
      query,
      ...options
    });
    return response.data;
  }

  async hybridSearch(
    textQuery: string,
    options: {
      top?: number;
      text_weight?: number;
      vector_weight?: number;
    } = {}
  ): Promise<{
    results: SearchResult[];
    search_time_ms: number;
    component_results: {
      text_count: number;
      vector_count: number;
    };
  }> {
    const response = await this.api.post('/api/search/hybrid', {
      text_query: textQuery,
      ...options
    });
    return response.data;
  }

  // Speech endpoints
  async speechToText(audioBlob: Blob): Promise<{ transcript: string; confidence: number }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    const response = await this.api.post('/api/speech/to-text', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  async textToSpeech(
    text: string,
    options: {
      voice?: string;
      rate?: number;
      pitch?: number;
    } = {}
  ): Promise<Blob> {
    const response = await this.api.post('/api/speech/to-speech', {
      text,
      ...options
    }, {
      responseType: 'blob',
    });

    return response.data;
  }

  // Document management
  async getDocument(documentId: string): Promise<SearchResult> {
    const response = await this.api.get(`/api/documents/${documentId}`);
    return response.data;
  }

  async deleteDocument(documentId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.api.delete(`/api/documents/${documentId}`);
    return response.data;
  }

  async listDocuments(
    options: {
      skip?: number;
      top?: number;
      category?: string;
      file_type?: string;
    } = {}
  ): Promise<{
    results: SearchResult[];
    total_count: number;
    has_more: boolean;
  }> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await this.api.get(`/api/documents?${params.toString()}`);
    return response.data;
  }

  // Statistics and monitoring
  async getSearchStatistics(): Promise<{
    document_count: number;
    storage_size_bytes: number;
    index_name: string;
  }> {
    const response = await this.api.get('/api/search/statistics');
    return response.data;
  }

  // Error handling utility
  handleError(error: any): string {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || error.response.statusText;
      return `Server Error (${error.response.status}): ${message}`;
    } else if (error.request) {
      // Request was made but no response received
      return 'Network Error: Unable to connect to server';
    } else {
      // Something else happened
      return `Error: ${error.message}`;
    }
  }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService;
