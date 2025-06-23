import React, { useState, useEffect } from 'react';
import { FileText, X, Check, Upload, Clock } from 'lucide-react';

interface UploadedDocument {
  id: string;
  filename: string;
  uploadedAt: string;
  size: number;
  type: string;
  selected?: boolean;
}

interface DocumentSelectorProps {
  selectedDocuments: string[];
  onDocumentSelectionChange: (documentIds: string[]) => void;
  onShowUploadedDocuments?: () => void;
  uploadedDocuments?: UploadedDocument[];
  recentUploads?: UploadedDocument[];
}

const DocumentSelector: React.FC<DocumentSelectorProps> = ({
  selectedDocuments,
  onDocumentSelectionChange,
  onShowUploadedDocuments,
  uploadedDocuments = [],
  recentUploads = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use uploadedDocuments if provided, otherwise fall back to recentUploads
  const documentsToShow = uploadedDocuments.length > 0 ? uploadedDocuments : recentUploads;

  const toggleDocumentSelection = (documentId: string) => {
    const updatedSelection = selectedDocuments.includes(documentId)
      ? selectedDocuments.filter(id => id !== documentId)
      : [...selectedDocuments, documentId];
    
    onDocumentSelectionChange(updatedSelection);
  };

  const clearAllSelections = () => {
    onDocumentSelectionChange([]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUploadTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-750"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-200">
            Reference Documents
          </span>
          {selectedDocuments.length > 0 && (
            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
              {selectedDocuments.length}
            </span>
          )}
        </div>
        <button className="text-gray-400 hover:text-gray-200">
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700">
          {/* Selected Documents Summary */}
          {selectedDocuments.length > 0 && (
            <div className="p-3 bg-gray-750">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={clearAllSelections}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center space-x-1"
                >
                  <X className="w-3 h-3" />
                  <span>Clear all</span>
                </button>
              </div>
            </div>
          )}

          {/* Recent Uploads List */}
          <div className="max-h-48 overflow-y-auto">
            {documentsToShow.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                <p className="text-sm">No documents uploaded yet</p>
                <p className="text-xs text-gray-600 mt-1">
                  Upload files to reference them in chat
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {documentsToShow.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                      selectedDocuments.includes(doc.id)
                        ? 'bg-blue-600/20 border border-blue-500/50'
                        : 'hover:bg-gray-700'
                    }`}
                    onClick={() => toggleDocumentSelection(doc.id)}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`flex-shrink-0 ${
                        selectedDocuments.includes(doc.id) ? 'text-blue-400' : 'text-gray-500'
                      }`}>
                        {selectedDocuments.includes(doc.id) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${
                          selectedDocuments.includes(doc.id) ? 'text-blue-200' : 'text-gray-200'
                        }`}>
                          {doc.filename}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatUploadTime(doc.uploadedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-3 border-t border-gray-700 bg-gray-750">
            <button
              onClick={onShowUploadedDocuments}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
            >
              <FileText className="w-3 h-3" />
              <span>View all uploaded documents</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentSelector;
