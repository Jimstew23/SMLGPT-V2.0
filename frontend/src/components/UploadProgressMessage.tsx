import React from 'react';
import { Loader2, CheckCircle, XCircle, Upload, Brain, Shield } from 'lucide-react';

interface UploadProgressMessageProps {
  filename: string;
  stage: 'uploading' | 'processing' | 'analyzing' | 'complete' | 'error';
  progress?: number;
  error?: string;
}

const UploadProgressMessage: React.FC<UploadProgressMessageProps> = ({ 
  filename, 
  stage, 
  progress,
  error 
}) => {
  const getStageMessage = () => {
    switch (stage) {
      case 'uploading':
        return `Uploading ${filename}...`;
      case 'processing':
        return `Processing with Azure Computer Vision...`;
      case 'analyzing':
        return `Analyzing safety hazards with GPT-4.1...`;
      case 'complete':
        return `${filename} uploaded and analyzed successfully`;
      case 'error':
        return error || `Failed to process ${filename}`;
      default:
        return `Processing ${filename}...`;
    }
  };

  const getStageIcon = () => {
    switch (stage) {
      case 'uploading':
        return <Upload className="w-5 h-5" />;
      case 'processing':
        return <Brain className="w-5 h-5" />;
      case 'analyzing':
        return <Shield className="w-5 h-5" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin" />;
    }
  };

  const getStageColor = () => {
    switch (stage) {
      case 'complete': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-sml-blue-500';
    }
  };

  const getBackgroundColor = () => {
    switch (stage) {
      case 'complete': return 'bg-green-500/10';
      case 'error': return 'bg-red-500/10';
      default: return 'bg-sml-blue-500/10';
    }
  };

  return (
    <div className={`flex items-start space-x-3 px-4 py-3 rounded-lg ${getBackgroundColor()}`}>
      <div className={`mt-0.5 ${getStageColor()}`}>
        {stage !== 'complete' && stage !== 'error' && (
          <Loader2 className="w-5 h-5 animate-spin" />
        )}
        {(stage === 'complete' || stage === 'error') && getStageIcon()}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${getStageColor()}`}>
          {getStageMessage()}
        </p>
        {progress !== undefined && stage === 'uploading' && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-chat-dark-text-secondary mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-chat-dark-tertiary rounded-full h-2">
              <div 
                className="h-2 bg-sml-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {stage === 'processing' && (
          <p className="text-xs text-chat-dark-text-secondary mt-1">
            Extracting text and identifying objects...
          </p>
        )}
        {stage === 'analyzing' && (
          <p className="text-xs text-chat-dark-text-secondary mt-1">
            Checking for safety hazards and compliance...
          </p>
        )}
      </div>
    </div>
  );
};

export default UploadProgressMessage;
