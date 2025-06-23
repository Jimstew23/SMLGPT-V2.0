const { AzureOpenAI } = require('openai');
const azureServices = require('./azureServices');
const searchService = require('./searchService');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Enhanced Safety Service with Memory, Reasoning, and Learning Capabilities
 * 
 * Features:
 * - Multi-step validation to reduce hallucinations
 * - Memory system for learning from previous analyses
 * - Advanced reasoning for safety close calls
 * - "Stop Work" detection with experience-based recommendations
 * - Confidence scoring and uncertainty handling
 * - Pattern recognition from historical data
 */
class EnhancedSafetyService {
  constructor() {
    // Initialize other non-client components
    this.loadSystemInstructions();
    this.initializeMemorySystem();
    this.safetyThresholds = {
      CRITICAL_STOP: 9.0,     // Immediate stop work
      HIGH_RISK: 7.0,         // Significant concern
      MODERATE_CONCERN: 5.0,  // Requires attention
      LOW_RISK: 3.0,          // Minor concern
      COMPLIANT: 0.0          // No issues
    };
    
    // Client initialization flags
    this.clientsInitialized = false;
    this.openaiClient = null;
    this.reasoningClient = null;
  }

  ensureClientsInitialized() {
    if (!this.clientsInitialized) {
      this.initializeClients();
      this.clientsInitialized = true;
    }
  }

  initializeClients() {
    try {
      // GPT-4.1 for main analysis
      this.openaiClient = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      });

      // Separate client for reasoning validation
      this.reasoningClient = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      });

      logger.info('Enhanced Safety Service initialized with dual AI validation');
    } catch (error) {
      logger.error('Failed to initialize Enhanced Safety Service:', error);
      throw error;
    }
  }

  async loadSystemInstructions() {
    try {
      const instructionsPath = path.join(__dirname, '..', '..', '..', 'SMLGPT_system_instructions.txt');
      this.systemInstructions = await fs.readFile(instructionsPath, 'utf8');
      
      // Enhanced safety-first instructions
      this.enhancedInstructions = `${this.systemInstructions}

ENHANCED SAFETY ANALYSIS PROTOCOL:

CRITICAL PRIORITY: Safety above all else. When in doubt, always err on the side of caution.

MULTI-STEP VALIDATION PROCESS:
1. Initial Analysis - Identify all potential hazards
2. Cross-validation - Verify findings against historical patterns
3. Confidence Assessment - Rate certainty of each finding
4. Stop Work Evaluation - Determine if immediate action required
5. Experience Integration - Apply lessons from similar past incidents

STOP WORK CONDITIONS (Immediate "STOP!" response required):
- Fall hazards without proper protection
- Electrical hazards with exposed conductors
- Chemical exposures exceeding safe limits
- Equipment operating outside safety parameters
- Missing critical PPE for high-risk activities
- Structural integrity concerns
- Fire/explosion risks
- Confined space entry without proper protocols

CONFIDENCE SCORING:
- 95-100%: Extremely confident (based on clear evidence)
- 85-94%: Highly confident (strong indicators present)
- 70-84%: Moderately confident (some uncertainty)
- 50-69%: Low confidence (significant uncertainty)
- Below 50%: Very uncertain (requires additional analysis)

LEARNING INTEGRATION:
- Reference historical incident patterns
- Apply lessons from similar workplace scenarios
- Incorporate feedback from previous analyses
- Update risk assessment based on new data patterns

REASONING TRANSPARENCY:
- Explain the logic behind each safety determination
- Identify what evidence supports each conclusion
- Highlight areas of uncertainty or conflicting indicators
- Provide alternative interpretations when applicable`;

      logger.info('Enhanced system instructions loaded successfully');
    } catch (error) {
      logger.error('Failed to load system instructions:', error);
      this.systemInstructions = "Safety analysis system ready.";
    }
  }

  async initializeMemorySystem() {
    try {
      this.memoryPath = path.join(__dirname, '..', 'data', 'safety_memory.json');
      
      // Load existing memory or create new
      try {
        const memoryData = await fs.readFile(this.memoryPath, 'utf8');
        this.safetyMemory = JSON.parse(memoryData);
      } catch (error) {
        this.safetyMemory = {
          analyses: [],
          patterns: {},
          incidents: [],
          recommendations: {},
          confidence_trends: {},
          stop_work_triggers: []
        };
      }

      logger.info(`Safety memory system initialized with ${this.safetyMemory.analyses.length} historical analyses`);
    } catch (error) {
      logger.error('Failed to initialize memory system:', error);
      this.safetyMemory = { analyses: [], patterns: {}, incidents: [] };
    }
  }

  async saveMemory() {
    try {
      await fs.mkdir(path.dirname(this.memoryPath), { recursive: true });
      await fs.writeFile(this.memoryPath, JSON.stringify(this.safetyMemory, null, 2));
      logger.info('Safety memory saved successfully');
    } catch (error) {
      logger.error('Failed to save safety memory:', error);
    }
  }

  async analyzeWithEnhancedSafety(imageBuffer, fileName = 'image') {
    this.ensureClientsInitialized();
    try {
      logger.info(`Starting enhanced safety analysis for: ${fileName}`);
      
      // Step 1: Initial AI Analysis
      const initialAnalysis = await this.performInitialAnalysis(imageBuffer, fileName);
      
      // Step 2: Cross-validation with Memory
      const memoryValidation = await this.crossValidateWithMemory(initialAnalysis);
      
      // Step 3: Confidence Assessment
      const confidenceAssessment = await this.assessConfidence(initialAnalysis, memoryValidation);
      
      // Step 4: Stop Work Evaluation
      const stopWorkEvaluation = await this.evaluateStopWork(initialAnalysis, confidenceAssessment);
      
      // Step 5: Final Integration and Reasoning
      const finalAnalysis = await this.integrateAnalysis(
        initialAnalysis, 
        memoryValidation, 
        confidenceAssessment, 
        stopWorkEvaluation
      );
      
      // Step 6: Learn and Update Memory
      await this.learnFromAnalysis(finalAnalysis, fileName);
      
      return finalAnalysis;
      
    } catch (error) {
      logger.error('Enhanced safety analysis failed:', error);
      throw new Error(`Enhanced safety analysis failed: ${error.message}`);
    }
  }

  async performInitialAnalysis(imageBuffer, fileName) {
    this.ensureClientsInitialized();
    try {
      // Get base64 image
      const base64Image = imageBuffer.toString('base64');
      
      const response = await this.openaiClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: this.enhancedInstructions
          },
          {
            role: 'user',
            content: `Perform a comprehensive safety analysis of this workplace image: ${fileName}. 
                
                Provide analysis in this JSON format:
                {
                  "overall_risk_level": "CRITICAL_STOP|HIGH_RISK|MODERATE_CONCERN|LOW_RISK|COMPLIANT",
                  "risk_score": 0-10,
                  "confidence_level": 0-100,
                  "stop_work_required": true/false,
                  "hazards": [
                    {
                      "type": "hazard_type",
                      "description": "detailed_description",
                      "severity": "Critical|High|Medium|Low",
                      "probability": "Very High|High|Medium|Low|Very Low",
                      "confidence": 0-100,
                      "evidence": "what_you_see_that_supports_this",
                      "location": "where_in_image"
                    }
                  ],
                  "sml_categories": ["relevant_safety_categories"],
                  "immediate_actions": ["stop_work_actions_if_needed"],
                  "recommendations": ["safety_recommendations"],
                  "reasoning": "explain_your_logic_and_decision_process"
                }`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ],
        max_tokens: 2000,
        temperature: 0.1 // Lower temperature for more consistent safety analysis
      });

      const analysisText = response.choices[0].message.content;
      return JSON.parse(this.extractJSONFromResponse(analysisText));
      
    } catch (error) {
      logger.error('Initial analysis failed:', error);
      throw error;
    }
  }

  async crossValidateWithMemory(initialAnalysis) {
    try {
      // Find similar past analyses
      const similarAnalyses = this.findSimilarAnalyses(initialAnalysis);
      
      // Check for pattern consistency
      const patternValidation = this.validateAgainstPatterns(initialAnalysis);
      
      // Historical incident check
      const incidentValidation = this.checkAgainstIncidents(initialAnalysis);
      
      return {
        similar_analyses: similarAnalyses,
        pattern_consistency: patternValidation,
        incident_alignment: incidentValidation,
        memory_confidence: this.calculateMemoryConfidence(similarAnalyses, patternValidation, incidentValidation)
      };
      
    } catch (error) {
      logger.error('Memory cross-validation failed:', error);
      return { memory_confidence: 50 }; // Neutral confidence if validation fails
    }
  }

  async assessConfidence(initialAnalysis, memoryValidation) {
    this.ensureClientsInitialized();
    try {
      const response = await this.reasoningClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are a safety analysis confidence assessor. Evaluate the certainty and reliability of safety analysis findings.
            
            Consider:
            - Clarity of visual evidence
            - Consistency with safety standards
            - Alignment with historical patterns
            - Completeness of information
            - Potential for misinterpretation`
          },
          {
            role: 'user',
            content: `Assess the confidence level of this safety analysis:
            
            Initial Analysis: ${JSON.stringify(initialAnalysis, null, 2)}
            Memory Validation: ${JSON.stringify(memoryValidation, null, 2)}
            
            Return confidence assessment as JSON:
            {
              "overall_confidence": 0-100,
              "hazard_confidence": {
                "hazard_type": confidence_score
              },
              "uncertainty_factors": ["list_of_uncertainty_sources"],
              "confidence_reasoning": "explain_confidence_assessment"
            }`
          }
        ],
        max_tokens: 800,
        temperature: 0.0 // Maximum consistency for confidence assessment
      });

      const confidenceText = response.choices[0].message.content;
      return JSON.parse(this.extractJSONFromResponse(confidenceText));
      
    } catch (error) {
      logger.error('Confidence assessment failed:', error);
      return { overall_confidence: 70, uncertainty_factors: ['Assessment system error'] };
    }
  }

  async evaluateStopWork(initialAnalysis, confidenceAssessment) {
    try {
      // Check critical thresholds
      const criticalHazards = initialAnalysis.hazards?.filter(h => 
        h.severity === 'Critical' || h.confidence >= 90
      ) || [];
      
      // High-confidence high-risk scenarios
      const highConfidenceRisks = initialAnalysis.hazards?.filter(h => 
        h.confidence >= 85 && (h.severity === 'High' || h.severity === 'Critical')
      ) || [];
      
      // Known stop work triggers from memory
      const memoryTriggers = this.safetyMemory.stop_work_triggers || [];
      const triggeredPatterns = memoryTriggers.filter(trigger => 
        this.matchesStopWorkPattern(initialAnalysis, trigger)
      );
      
      const stopWorkRequired = 
        criticalHazards.length > 0 || 
        highConfidenceRisks.length >= 2 ||
        triggeredPatterns.length > 0 ||
        initialAnalysis.stop_work_required;
      
      return {
        stop_work_required: stopWorkRequired,
        critical_hazards: criticalHazards,
        high_confidence_risks: highConfidenceRisks,
        triggered_patterns: triggeredPatterns,
        stop_work_reasoning: stopWorkRequired ? 
          `STOP WORK REQUIRED: ${this.generateStopWorkReasoning(criticalHazards, highConfidenceRisks, triggeredPatterns)}` : 
          'Work may proceed with recommended safety measures'
      };
      
    } catch (error) {
      logger.error('Stop work evaluation failed:', error);
      // Default to caution - if evaluation fails, recommend stopping work
      return {
        stop_work_required: true,
        stop_work_reasoning: 'STOP WORK REQUIRED: Safety evaluation system error - proceed with extreme caution'
      };
    }
  }

  async integrateAnalysis(initialAnalysis, memoryValidation, confidenceAssessment, stopWorkEvaluation) {
    try {
      // Calculate final risk score with confidence weighting
      const weightedRiskScore = this.calculateWeightedRiskScore(
        initialAnalysis.risk_score,
        confidenceAssessment.overall_confidence,
        memoryValidation.memory_confidence
      );
      
      // Determine final risk level
      const finalRiskLevel = this.determineRiskLevel(weightedRiskScore, stopWorkEvaluation.stop_work_required);
      
      // Generate comprehensive recommendations
      const enhancedRecommendations = await this.generateEnhancedRecommendations(
        initialAnalysis,
        memoryValidation,
        stopWorkEvaluation
      );
      
      return {
        // Core analysis
        overall_risk_level: finalRiskLevel,
        risk_score: weightedRiskScore,
        hazards: initialAnalysis.hazards || [],
        sml_categories: initialAnalysis.sml_categories || [],
        
        // Enhanced features
        stop_work_required: stopWorkEvaluation.stop_work_required,
        stop_work_reasoning: stopWorkEvaluation.stop_work_reasoning,
        confidence_level: confidenceAssessment.overall_confidence,
        memory_validation: memoryValidation,
        
        // Recommendations
        immediate_actions: stopWorkEvaluation.stop_work_required ? 
          ['STOP ALL WORK IMMEDIATELY', ...initialAnalysis.immediate_actions || []] :
          initialAnalysis.immediate_actions || [],
        recommendations: enhancedRecommendations,
        
        // Reasoning and transparency
        analysis_reasoning: initialAnalysis.reasoning || '',
        confidence_reasoning: confidenceAssessment.confidence_reasoning || '',
        uncertainty_factors: confidenceAssessment.uncertainty_factors || [],
        
        // Metadata
        analysis_timestamp: new Date().toISOString(),
        analysis_version: '2.0_enhanced',
        validation_method: 'multi_step_ai_memory'
      };
      
    } catch (error) {
      logger.error('Analysis integration failed:', error);
      throw error;
    }
  }

  // Helper methods for memory and reasoning
  findSimilarAnalyses(currentAnalysis) {
    // Implementation for finding similar historical analyses
    return this.safetyMemory.analyses.filter(analysis => 
      this.calculateSimilarity(currentAnalysis, analysis) > 0.7
    ).slice(0, 5); // Top 5 similar analyses
  }

  calculateSimilarity(analysis1, analysis2) {
    // Simple similarity calculation based on hazard types and categories
    const hazards1 = new Set((analysis1.hazards || []).map(h => h.type));
    const hazards2 = new Set((analysis2.hazards || []).map(h => h.type));
    const categories1 = new Set(analysis1.sml_categories || []);
    const categories2 = new Set(analysis2.sml_categories || []);
    
    const hazardIntersection = new Set([...hazards1].filter(x => hazards2.has(x)));
    const categoryIntersection = new Set([...categories1].filter(x => categories2.has(x)));
    
    const hazardSimilarity = hazardIntersection.size / Math.max(hazards1.size, hazards2.size, 1);
    const categorySimilarity = categoryIntersection.size / Math.max(categories1.size, categories2.size, 1);
    
    return (hazardSimilarity + categorySimilarity) / 2;
  }

  async learnFromAnalysis(finalAnalysis, fileName) {
    try {
      // Add to memory
      this.safetyMemory.analyses.push({
        ...finalAnalysis,
        file_name: fileName,
        learned_at: new Date().toISOString()
      });
      
      // Update patterns
      this.updatePatterns(finalAnalysis);
      
      // Keep memory size manageable (last 1000 analyses)
      if (this.safetyMemory.analyses.length > 1000) {
        this.safetyMemory.analyses = this.safetyMemory.analyses.slice(-1000);
      }
      
      // Save updated memory
      await this.saveMemory();
      
      logger.info(`Learned from analysis: ${fileName}`);
    } catch (error) {
      logger.error('Failed to learn from analysis:', error);
    }
  }

  extractJSONFromResponse(text) {
    try {
      // Extract JSON from response that might have additional text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? jsonMatch[0] : text;
    } catch (error) {
      logger.error('Failed to extract JSON:', error);
      return text;
    }
  }

  // Additional helper methods...
  calculateWeightedRiskScore(baseScore, confidence, memoryConfidence) {
    const weightedScore = (baseScore * confidence / 100) + ((memoryConfidence - 50) / 50);
    return Math.max(0, Math.min(10, weightedScore));
  }

  determineRiskLevel(score, stopWorkRequired) {
    if (stopWorkRequired || score >= this.safetyThresholds.CRITICAL_STOP) return 'CRITICAL_STOP';
    if (score >= this.safetyThresholds.HIGH_RISK) return 'HIGH_RISK';
    if (score >= this.safetyThresholds.MODERATE_CONCERN) return 'MODERATE_CONCERN';
    if (score >= this.safetyThresholds.LOW_RISK) return 'LOW_RISK';
    return 'COMPLIANT';
  }

  async generateEnhancedRecommendations(initialAnalysis, memoryValidation, stopWorkEvaluation) {
    const recommendations = [...(initialAnalysis.recommendations || [])];
    
    // Add memory-based recommendations
    if (memoryValidation.similar_analyses?.length > 0) {
      const memoryRecs = memoryValidation.similar_analyses
        .flatMap(analysis => analysis.recommendations || [])
        .filter((rec, index, arr) => arr.indexOf(rec) === index); // Remove duplicates
      recommendations.push(...memoryRecs);
    }
    
    // Add stop work specific recommendations
    if (stopWorkEvaluation.stop_work_required) {
      recommendations.unshift(
        'IMMEDIATELY STOP ALL WORK IN THE AREA',
        'SECURE THE WORK AREA AND PREVENT ACCESS',
        'NOTIFY SAFETY SUPERVISOR IMMEDIATELY',
        'DO NOT RESUME WORK UNTIL HAZARDS ARE MITIGATED'
      );
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  generateStopWorkReasoning(criticalHazards, highConfidenceRisks, triggeredPatterns) {
    const reasons = [];
    
    if (criticalHazards.length > 0) {
      reasons.push(`Critical hazards detected: ${criticalHazards.map(h => h.type).join(', ')}`);
    }
    
    if (highConfidenceRisks.length >= 2) {
      reasons.push(`Multiple high-confidence risks identified: ${highConfidenceRisks.map(h => h.type).join(', ')}`);
    }
    
    if (triggeredPatterns.length > 0) {
      reasons.push(`Historical incident patterns matched: ${triggeredPatterns.map(p => p.name).join(', ')}`);
    }
    
    return reasons.join('. ');
  }

  matchesStopWorkPattern(analysis, pattern) {
    // Simple pattern matching logic
    return pattern.hazard_types?.some(type => 
      analysis.hazards?.some(hazard => hazard.type.includes(type))
    );
  }

  validateAgainstPatterns(analysis) {
    // Validate against known safety patterns
    return { consistency_score: 85 }; // Placeholder
  }

  checkAgainstIncidents(analysis) {
    // Check against historical incidents
    return { incident_risk_score: 70 }; // Placeholder
  }

  calculateMemoryConfidence(similarAnalyses, patternValidation, incidentValidation) {
    // Calculate confidence based on memory validation
    const baseConfidence = 50;
    const similarityBoost = similarAnalyses.length > 0 ? 20 : 0;
    const patternBoost = patternValidation.consistency_score > 80 ? 15 : 0;
    const incidentPenalty = incidentValidation.incident_risk_score > 80 ? -10 : 0;
    
    return Math.max(0, Math.min(100, baseConfidence + similarityBoost + patternBoost + incidentPenalty));
  }

  updatePatterns(analysis) {
    // Update pattern recognition database
    const category = analysis.overall_risk_level;
    if (!this.safetyMemory.patterns[category]) {
      this.safetyMemory.patterns[category] = [];
    }
    
    this.safetyMemory.patterns[category].push({
      hazards: analysis.hazards?.map(h => h.type) || [],
      categories: analysis.sml_categories || [],
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
const enhancedSafetyService = new EnhancedSafetyService();

module.exports = enhancedSafetyService;
