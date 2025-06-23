/**
 * Safety Helper Utilities for Enhanced SMLGPT System
 * Provides utilities for handling enhanced safety analysis, confidence scoring, and UI formatting
 */

import { SafetyAnalysis, SafetyFlag, HazardData } from '../types';

// Risk level color mappings for UI
export const getRiskLevelColor = (riskLevel: string): string => {
  switch (riskLevel) {
    case 'CRITICAL_STOP':
      return '#dc2626'; // Red-600
    case 'HIGH_RISK':
      return '#ea580c'; // Orange-600
    case 'MODERATE_CONCERN':
      return '#d97706'; // Amber-600
    case 'LOW_RISK':
      return '#16a34a'; // Green-600
    case 'MINIMAL_RISK':
      return '#059669'; // Emerald-600
    default:
      return '#6b7280'; // Gray-500
  }
};

// Get risk level emoji
export const getRiskLevelEmoji = (riskLevel: string): string => {
  switch (riskLevel) {
    case 'CRITICAL_STOP':
      return '🚨';
    case 'HIGH_RISK':
      return '🔴';
    case 'MODERATE_CONCERN':
      return '🟡';
    case 'LOW_RISK':
      return '🟢';
    case 'MINIMAL_RISK':
      return '✅';
    default:
      return '❓';
  }
};

// Format confidence level for display
export const formatConfidenceLevel = (confidence: number): string => {
  if (confidence >= 90) return 'Very High';
  if (confidence >= 75) return 'High';
  if (confidence >= 60) return 'Moderate';
  if (confidence >= 40) return 'Low';
  return 'Very Low';
};

// Get confidence color
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 80) return '#059669'; // Green
  if (confidence >= 60) return '#d97706'; // Amber
  if (confidence >= 40) return '#ea580c'; // Orange
  return '#dc2626'; // Red
};

// Check if analysis requires immediate attention
export const requiresImmediateAttention = (analysis: SafetyAnalysis): boolean => {
  return analysis.stop_work_required || 
         analysis.risk_level === 'CRITICAL_STOP' ||
         analysis.risk_level === 'HIGH_RISK' ||
         (analysis.risk_score !== undefined && analysis.risk_score >= 8);
};

// Format hazard severity
export const formatHazardSeverity = (severity: string): string => {
  return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
};

// Get hazard severity color
export const getHazardSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return '#dc2626';
    case 'high':
      return '#ea580c';
    case 'medium':
      return '#d97706';
    case 'low':
      return '#16a34a';
    default:
      return '#6b7280';
  }
};

// Calculate overall safety score from analysis
export const calculateSafetyScore = (analysis: SafetyAnalysis): number => {
  const baseScore = analysis.risk_score || 0;
  const confidenceWeight = (analysis.confidence_level || 0) / 100;
  const stopWorkPenalty = analysis.stop_work_required ? 2 : 0;
  
  return Math.min(10, baseScore + stopWorkPenalty) * confidenceWeight;
};

// Format timestamp for display
export const formatAnalysisTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Generate safety alert message
export const generateSafetyAlert = (analysis: SafetyAnalysis): string => {
  if (analysis.stop_work_required) {
    return `🚨 STOP WORK IMMEDIATELY - ${analysis.stop_work_reasoning || 'Critical safety hazard detected'}`;
  }
  
  if (analysis.risk_level === 'HIGH_RISK') {
    return `⚠️ HIGH RISK - Immediate attention required`;
  }
  
  if (analysis.risk_level === 'MODERATE_CONCERN') {
    return `⚠️ MODERATE RISK - Safety precautions recommended`;
  }
  
  return `✅ ACCEPTABLE RISK - Continue with standard safety protocols`;
};

// Validate safety analysis completeness
export const validateAnalysisCompleteness = (analysis: SafetyAnalysis): string[] => {
  const issues: string[] = [];
  
  if (!analysis.risk_level) {
    issues.push('Missing risk level assessment');
  }
  
  if (analysis.confidence_level === undefined || analysis.confidence_level < 50) {
    issues.push('Low confidence level - analysis may be unreliable');
  }
  
  if (!analysis.hazards || analysis.hazards.length === 0) {
    issues.push('No hazards identified - verify image quality');
  }
  
  if (!analysis.analysis_reasoning) {
    issues.push('Missing analysis reasoning');
  }
  
  return issues;
};

// Sort hazards by severity and confidence
export const sortHazardsBySeverity = (hazards: HazardData[]): HazardData[] => {
  const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
  
  return [...hazards].sort((a, b) => {
    const aSeverity = severityOrder[a.severity?.toLowerCase() as keyof typeof severityOrder] || 0;
    const bSeverity = severityOrder[b.severity?.toLowerCase() as keyof typeof severityOrder] || 0;
    
    if (aSeverity !== bSeverity) {
      return bSeverity - aSeverity; // High to low severity
    }
    
    // If same severity, sort by confidence (high to low)
    return (b.confidence || 0) - (a.confidence || 0);
  });
};

// Extract action items from analysis
export const extractActionItems = (analysis: SafetyAnalysis): string[] => {
  const actions: string[] = [];
  
  // Add immediate actions
  if (analysis.immediate_actions) {
    actions.push(...analysis.immediate_actions);
  }
  
  // Add stop work action if required
  if (analysis.stop_work_required) {
    actions.unshift('STOP WORK IMMEDIATELY');
  }
  
  // Add recommendations as actions
  if (analysis.recommendations) {
    actions.push(...analysis.recommendations);
  }
  
  return Array.from(new Set(actions)); // Remove duplicates
};

// Check if memory integration is available
export const hasMemoryIntegration = (analysis: SafetyAnalysis): boolean => {
  return !!(analysis.memory_validation && 
           analysis.memory_validation.similar_analyses && 
           analysis.memory_validation.similar_analyses.length > 0);
};

// Format memory integration info
export const formatMemoryIntegration = (analysis: SafetyAnalysis): string => {
  if (!hasMemoryIntegration(analysis)) {
    return 'No similar scenarios found in safety database';
  }
  
  const count = analysis.memory_validation!.similar_analyses!.length;
  const confidence = analysis.memory_validation!.memory_confidence || 0;
  
  return `Analysis draws from ${count} similar workplace scenario${count > 1 ? 's' : ''} (${confidence}% memory confidence)`;
};

// Generate safety report summary
export const generateSafetyReportSummary = (analysis: SafetyAnalysis): string => {
  const riskEmoji = getRiskLevelEmoji(analysis.risk_level || '');
  const confidenceLevel = formatConfidenceLevel(analysis.confidence_level || 0);
  const hazardCount = analysis.hazards?.length || 0;
  const actionCount = extractActionItems(analysis).length;
  
  return `${riskEmoji} ${analysis.risk_level || 'UNKNOWN'} | ${confidenceLevel} Confidence | ${hazardCount} Hazard${hazardCount !== 1 ? 's' : ''} | ${actionCount} Action${actionCount !== 1 ? 's' : ''}`;
};

// Audio alert for critical safety issues
export const playAudioAlert = (): void => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance('Critical safety alert detected. Stop work immediately.');
    utterance.rate = 1.2;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  }
};

export default {
  getRiskLevelColor,
  getRiskLevelEmoji,
  formatConfidenceLevel,
  getConfidenceColor,
  requiresImmediateAttention,
  formatHazardSeverity,
  getHazardSeverityColor,
  calculateSafetyScore,
  formatAnalysisTimestamp,
  generateSafetyAlert,
  validateAnalysisCompleteness,
  sortHazardsBySeverity,
  extractActionItems,
  hasMemoryIntegration,
  formatMemoryIntegration,
  generateSafetyReportSummary,
  playAudioAlert
};
