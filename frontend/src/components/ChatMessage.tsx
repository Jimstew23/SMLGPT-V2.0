import React from 'react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
  onSpeakMessage?: (text: string) => void;
}

interface SafetyAnalysis {
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  hazards?: string[];
  recommendations?: string[];
  compliance?: string[];
}

interface FileAttachment {
  name: string;
  type: string;
  url?: string;
  size?: number;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLast = false, onSpeakMessage }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Parse safety analysis from message content if it exists
  const parseSafetyAnalysis = (content: string): SafetyAnalysis | null => {
    try {
      // Look for structured safety analysis patterns
      const riskMatch = content.match(/Risk Level:\s*(LOW|MEDIUM|HIGH|CRITICAL)/i);
      const hazardsMatch = content.match(/Hazards?:?\s*([^\n]+)/i);
      const recommendationsMatch = content.match(/Recommendations?:?\s*([^\n]+)/i);
      
      if (riskMatch || hazardsMatch || recommendationsMatch) {
        return {
          riskLevel: riskMatch?.[1]?.toUpperCase() as SafetyAnalysis['riskLevel'],
          hazards: hazardsMatch?.[1]?.split(',').map(h => h.trim()),
          recommendations: recommendationsMatch?.[1]?.split(',').map(r => r.trim())
        };
      }
    } catch (error) {
      console.error('Error parsing safety analysis:', error);
    }
    return null;
  };

  // Parse file attachments from message
  const parseAttachments = (content: string): FileAttachment[] => {
    const attachments: FileAttachment[] = [];
    // Look for file references in the message
    const fileMatches = content.match(/\[File: ([^\]]+)\]/g);
    if (fileMatches) {
      fileMatches.forEach(match => {
        const fileName = match.replace(/\[File: ([^\]]+)\]/, '$1');
        attachments.push({ name: fileName, type: 'unknown' });
      });
    }
    return attachments;
  };

  // Render markdown-like content
  const renderContent = (content: string) => {
    // Simple markdown rendering for basic formatting
    let rendered = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br />');
    
    return <div dangerouslySetInnerHTML={{ __html: rendered }} />;
  };

  // Get safety flag color based on risk level
  const getSafetyFlagColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'CRITICAL': return '#ff0000';
      case 'HIGH': return '#ff6600';
      case 'MEDIUM': return '#ffcc00';
      case 'LOW': return '#00cc00';
      default: return '#cccccc';
    }
  };

  const safetyAnalysis = isAssistant ? parseSafetyAnalysis(message.content) : null;
  const attachments = parseAttachments(message.content);

  if (isUser) {
    return (
      <div className="message user">
        <div className="bubble">
          {renderContent(message.content)}
          {attachments.length > 0 && (
            <div className="attachments">
              {attachments.map((attachment, index) => (
                <div key={index} className="attachment">
                  📎 {attachment.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="timestamp">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div className="message ai">
        <img src="/SML.png" alt="SML logo" className="ai-small-logo"/>
        <div>
          {safetyAnalysis && (
            <div className="safety-analysis" style={{ 
              border: `2px solid ${getSafetyFlagColor(safetyAnalysis.riskLevel)}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '8px',
              backgroundColor: `${getSafetyFlagColor(safetyAnalysis.riskLevel)}10`
            }}>
              {safetyAnalysis.riskLevel && (
                <div className="risk-level" style={{ 
                  color: getSafetyFlagColor(safetyAnalysis.riskLevel),
                  fontWeight: 'bold',
                  fontSize: '16px',
                  marginBottom: '8px'
                }}>
                  ⚠️ Risk Level: {safetyAnalysis.riskLevel}
                </div>
              )}
              {safetyAnalysis.hazards && safetyAnalysis.hazards.length > 0 && (
                <div className="hazards">
                  <strong>🚨 Hazards:</strong>
                  <ul>
                    {safetyAnalysis.hazards.map((hazard, index) => (
                      <li key={index}>{hazard}</li>
                    ))}
                  </ul>
                </div>
              )}
              {safetyAnalysis.recommendations && safetyAnalysis.recommendations.length > 0 && (
                <div className="recommendations">
                  <strong>✅ Recommendations:</strong>
                  <ul>
                    {safetyAnalysis.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="bubble">
            {renderContent(message.content)}
          </div>
          <div className="message-actions">
            <div className="timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
            {onSpeakMessage && (
              <button 
                className="speak-button"
                onClick={() => onSpeakMessage(message.content)}
                title="Speak message"
              >
                🔊
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ChatMessage;
