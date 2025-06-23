/**
 * Formatting and Validation Utilities for SMLGPT V2.0
 * Provides consistent formatting across the application
 */

import { SafetyAnalysis, HazardData, SafetyFlag } from '../types';

/**
 * Format risk score as percentage or numeric display
 */
export const formatRiskScore = (score: number, format: 'percentage' | 'numeric' = 'numeric'): string => {
  if (format === 'percentage') {
    return `${Math.round(score * 10)}%`;
  }
  return `${score.toFixed(1)}/10`;
};

/**
 * Format confidence as colored badge text
 */
export const formatConfidenceBadge = (confidence: number): {
  text: string;
  color: string;
  bgColor: string;
} => {
  if (confidence >= 90) {
    return {
      text: 'Very High',
      color: '#065f46',
      bgColor: '#d1fae5'
    };
  } else if (confidence >= 75) {
    return {
      text: 'High',
      color: '#166534',
      bgColor: '#dcfce7'
    };
  } else if (confidence >= 60) {
    return {
      text: 'Moderate',
      color: '#92400e',
      bgColor: '#fef3c7'
    };
  } else if (confidence >= 40) {
    return {
      text: 'Low',
      color: '#c2410c',
      bgColor: '#fed7aa'
    };
  } else {
    return {
      text: 'Very Low',
      color: '#991b1b',
      bgColor: '#fecaca'
    };
  }
};

/**
 * Format duration in milliseconds to readable format
 */
export const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
};

/**
 * Format file size to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format timestamp to various formats
 */
export const formatTimestamp = (
  timestamp: string, 
  format: 'short' | 'long' | 'time' | 'date' = 'short'
): string => {
  const date = new Date(timestamp);
  
  switch (format) {
    case 'short':
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'long':
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    case 'time':
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'date':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    default:
      return date.toLocaleString();
  }
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Format list items with proper punctuation
 */
export const formatListItems = (items: string[]): string[] => {
  return items.map(item => {
    const trimmed = item.trim();
    if (!trimmed) return trimmed;
    
    // Ensure item ends with proper punctuation
    const lastChar = trimmed.slice(-1);
    if (!['.', '!', '?', ':', ';'].includes(lastChar)) {
      return trimmed + '.';
    }
    return trimmed;
  });
};

/**
 * Format hazard description for display
 */
export const formatHazardDescription = (hazard: HazardData): string => {
  let description = hazard.description || 'No description available';
  
  // Add location if available
  if (hazard.location && hazard.location !== 'General area') {
    description += ` (Location: ${hazard.location})`;
  }
  
  // Add evidence if available and not already in description
  if (hazard.evidence && hazard.evidence.length > 0) {
    const evidenceText = hazard.evidence.join(', ');
    if (!description.toLowerCase().includes(evidenceText.toLowerCase())) {
      description += ` - Evidence: ${evidenceText}`;
    }
  }
  
  return description;
};

/**
 * Format safety flag for notification display
 */
export const formatSafetyFlagNotification = (flag: SafetyFlag): {
  title: string;
  message: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
} => {
  const urgency = flag.requires_immediate_action ? 'critical' : 
                 flag.level === 'Critical' ? 'critical' :
                 flag.level === 'Moderate' ? 'medium' : 'low';
  
  let title = '';
  switch (flag.type) {
    case 'stop_work':
      title = '🚨 STOP WORK ALERT';
      break;
    case 'risk_assessment':
      title = '📊 Risk Assessment Alert';
      break;
    case 'ppe_required':
      title = '🦺 PPE Required';
      break;
    default:
      title = '⚠️ Safety Notification';
  }
  
  return {
    title,
    message: flag.message || flag.description || 'Safety alert triggered',
    urgency
  };
};

/**
 * Format safety flag for alert display
 */
export const formatSafetyFlagAlert = (flag: SafetyFlag): {
  title: string;
  message: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
} => {
  const urgency = flag.requires_immediate_action ? 'critical' : 
                 flag.level === 'Critical' ? 'critical' :
                 flag.level === 'Moderate' ? 'medium' : 'low';
  
  let title = '';
  switch (flag.type) {
    case 'PPE_MISSING':
      title = '⚠️ Personal Protective Equipment Required';
      break;
    case 'HAZARDOUS_MATERIAL':
      title = '☢️ Hazardous Material Detected';
      break;
    case 'UNSAFE_CONDITION':
      title = '🚧 Unsafe Working Condition';
      break;
    default:
      title = '🔔 Safety Alert';
  }
  
  return {
    title,
    message: flag.message || flag.description || 'Safety alert triggered',
    urgency
  };
};

/**
 * Validate and format user input
 */
export const validateAndFormatInput = (input: string, maxLength: number = 1000): {
  isValid: boolean;
  formatted: string;
  errors: string[];
} => {
  const errors: string[] = [];
  let formatted = input.trim();
  
  // Check length
  if (formatted.length === 0) {
    errors.push('Input cannot be empty');
  } else if (formatted.length > maxLength) {
    errors.push(`Input cannot exceed ${maxLength} characters`);
    formatted = formatted.substring(0, maxLength);
  }
  
  // Check for potentially harmful content (basic)
  const harmfulPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];
  
  harmfulPatterns.forEach(pattern => {
    if (pattern.test(formatted)) {
      errors.push('Input contains potentially harmful content');
    }
  });
  
  // Clean up common formatting issues
  formatted = formatted
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double newline
    .trim();
  
  return {
    isValid: errors.length === 0,
    formatted,
    errors
  };
};

/**
 * Format memory integration information
 */
export const formatMemoryInfo = (analysis: SafetyAnalysis): string => {
  if (!analysis.memory_validation) {
    return 'No memory integration available';
  }
  
  const { similar_analyses = [], memory_confidence = 0 } = analysis.memory_validation;
  
  if (similar_analyses.length === 0) {
    return 'No similar scenarios found in safety database';
  }
  
  const avgSimilarity = similar_analyses.reduce((sum, a) => sum + a.similarity_score, 0) / similar_analyses.length;
  
  return `Found ${similar_analyses.length} similar workplace scenario${similar_analyses.length > 1 ? 's' : ''} (${memory_confidence}% confidence, avg similarity: ${Math.round(avgSimilarity)}%)`;
};

/**
 * Format uncertainty factors for display
 */
export const formatUncertaintyFactors = (factors: string[]): string => {
  if (!factors || factors.length === 0) {
    return 'No uncertainty factors identified';
  }
  
  return factors.map((factor, index) => 
    `${index + 1}. ${factor}`
  ).join('\n');
};

/**
 * Generate summary statistics from analysis
 */
export const generateAnalysisStats = (analysis: SafetyAnalysis): {
  totalHazards: number;
  criticalHazards: number;
  averageConfidence: number;
  riskCategories: string[];
} => {
  const hazards = analysis.hazards || [];
  const criticalHazards = hazards.filter(h => 
    h.severity === 'Critical' || h.severity === 'High'
  ).length;
  
  const averageConfidence = hazards.length > 0 
    ? hazards.reduce((sum, h) => sum + (h.confidence || 0), 0) / hazards.length
    : analysis.confidence_level || 0;
  
  const riskCategories = Array.from(new Set(
    hazards.map(h => h.category || 'General').filter(Boolean)
  ));
  
  return {
    totalHazards: hazards.length,
    criticalHazards,
    averageConfidence: Math.round(averageConfidence),
    riskCategories
  };
};

/**
 * Format analysis for export (CSV, JSON, etc.)
 */
export const formatAnalysisForExport = (analysis: SafetyAnalysis, format: 'csv' | 'json' = 'json'): string => {
  if (format === 'json') {
    return JSON.stringify(analysis, null, 2);
  }
  
  // CSV format
  const headers = [
    'Timestamp',
    'Risk Level',
    'Risk Score',
    'Confidence',
    'Stop Work',
    'Hazards Count',
    'Analysis Version'
  ];
  
  const values = [
    analysis.analysis_timestamp || '',
    analysis.risk_level || '',
    analysis.risk_score?.toString() || '',
    analysis.confidence_level?.toString() || '',
    analysis.stop_work_required ? 'Yes' : 'No',
    (analysis.hazards?.length || 0).toString(),
    analysis.analysis_version || ''
  ];
  
  return [headers.join(','), values.join(',')].join('\n');
};

export default {
  formatRiskScore,
  formatConfidenceBadge,
  formatDuration,
  formatFileSize,
  formatTimestamp,
  truncateText,
  formatListItems,
  formatHazardDescription,
  formatSafetyFlagNotification,
  formatSafetyFlagAlert,
  validateAndFormatInput,
  formatMemoryInfo,
  formatUncertaintyFactors,
  generateAnalysisStats,
  formatAnalysisForExport
};
