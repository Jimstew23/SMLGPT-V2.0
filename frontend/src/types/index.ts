// Core SMLGPT V2.0 Types
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  type?: 'text' | 'image' | 'document' | 'voice';
  files?: FileUpload[];
  safetyAnalysis?: SafetyAnalysis;
  component?: React.ReactNode; // For system messages with custom components
  file?: { 
    name: string;
    type: string;
    previewUrl: string;
    size: number;
  };
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    imageUrl?: string;
    analysisResults?: SafetyAnalysis;
    speechDuration?: number;
  };
}

export interface SafetyAnalysis {
  risk_level: 'CRITICAL_STOP' | 'HIGH_RISK' | 'MODERATE_CONCERN' | 'LOW_RISK' | 'COMPLIANT';
  score: number;
  summary: string;
  hazards: Hazard[];
  sml_categories: SMLCategory[];
  recommendations: string[];
  controls: Control[];
  safety_flags: SafetyFlag[];
  
  // Enhanced Safety Analysis Properties
  confidence_level?: number;
  stop_work_required?: boolean;
  stop_work_reasoning?: string;
  analysis_timestamp?: string;
  risk_score?: number;
  analysis_reasoning?: string;
  analysis_version?: string;
  immediate_actions?: string[];
  
  // Memory Integration
  memory_validation?: {
    similar_analyses: Array<{
      timestamp: string;
      risk_level: string;
      similarity_score: number;
      key_insights: string[];
    }>;
    memory_confidence: number;
    learning_insights: string[];
  };
}

export interface Hazard {
  type: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  probability: 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
  risk_score: number;
  
  // Enhanced Hazard Properties
  confidence?: number;
  category?: string;
  location?: string;
  evidence?: string[];
  recommendations?: string[];
}

// Additional type alias for backwards compatibility
export type HazardData = Hazard;

export interface SMLCategory {
  name: string;
  applicable: boolean;
  confidence: number;
  description?: string;
  logo_url?: string;
}

export interface Control {
  hierarchy_level: 'Elimination' | 'Substitution' | 'Engineering' | 'Administrative' | 'PPE';
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  implementation_status?: 'Required' | 'Recommended' | 'Optional';
}

export interface SafetyFlag {
  type: string;
  level: 'Critical' | 'Moderate' | 'Low';
  description: string;
  
  // Enhanced Safety Flag Properties
  requires_immediate_action?: boolean;
  message?: string;
  confidence?: number;
  evidence?: string[];
}

export interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
  result?: SafetyAnalysis;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  created_at: Date;
  updated_at: Date;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  file_type: string;
  uploaded_at: string;
  relevance_score: number;
  highlights?: { [key: string]: string[] };
}

export interface VoiceRecording {
  id: string;
  status: 'recording' | 'processing' | 'completed' | 'error';
  duration: number;
  transcript?: string;
  error?: string;
}

export interface AppConfig {
  maxFileSize: number;
  supportedFileTypes: string[];
  speechEnabled: boolean;
  searchEnabled: boolean;
  darkMode: boolean;
}
