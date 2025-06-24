import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Send, Paperclip, Mic, MicOff, X, Upload } from 'lucide-react';
import { FileUpload } from '../types';
import toast from 'react-hot-toast';

interface ChatInputProps {
  onSendMessage: (message: string, files?: File[]) => void;
  onFileUpload: (files: FileList) => void;
  onVoiceRecording?: (isRecording: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
  isRecording?: boolean;
  pendingUploads?: FileUpload[];
  uploadProgress?: string;
  isUploading?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onFileUpload,
  onVoiceRecording,
  isLoading = false,
  disabled = false,
  isRecording = false,
  pendingUploads = [],
  uploadProgress
}) => {
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedFileTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/bmp': ['.bmp'],
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
  };

  const maxFileSize = 50 * 1024 * 1024; // 50MB

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > maxFileSize) {
        console.warn(`File ${file.name} is too large (max 50MB)`);
        return false;
      }
      return true;
    });

    // Convert File[] to FileList for ChatGPT-style upload
    if (validFiles.length > 0) {
      const dt = new DataTransfer();
      validFiles.forEach(file => dt.items.add(file));
      onFileUpload(dt.files);
      
      // Show toast notification that upload has started
      toast(`Uploading ${validFiles.length} file(s)...`, { id: 'upload-start' });
      
      // Clear selected files to avoid duplicate thumbnails
      setSelectedFiles([]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: supportedFileTypes,
    maxSize: maxFileSize,
    noClick: true,
    noKeyboard: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && selectedFiles.length === 0) || disabled || isLoading) return;

    onSendMessage(message.trim(), selectedFiles.length > 0 ? selectedFiles : undefined);
    setMessage('');
    setSelectedFiles([]);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Trigger immediate file upload when files are selected
      onFileUpload(e.target.files);
      
      // Show toast notification that upload has started
      toast(`Uploading ${e.target.files.length} file(s)...`, { id: 'upload-start' });
      
      // Clear the file input to allow re-uploading the same file
      e.target.value = '';
      setSelectedFiles([]);
    }
  };

  const toggleVoiceRecording = () => {
    onVoiceRecording?.(!isRecording);
  };

  // Create preview URL for images
  const createImagePreview = (file: File): string | null => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  // Get file icon with proper colors based on file type
  const getFileIconStyle = (file: File): { icon: string; color: string; bgColor: string } => {
    // Log file info for debugging
    console.log('ChatInput file type detection:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Image files
    if (file.type.startsWith('image/')) return { icon: '🖼️', color: '#666', bgColor: '#f0f0f0' };
    
    // PDF files
    if (file.type === 'application/pdf') return { icon: '📄', color: '#ffffff', bgColor: '#ff6b6b' }; // Light red
    
    // PowerPoint files - enhanced detection
    if (file.type.includes('presentation') || 
        file.type.includes('powerpoint') ||
        file.type === 'application/vnd.ms-powerpoint' ||
        file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        file.name.toLowerCase().endsWith('.ppt') ||
        file.name.toLowerCase().endsWith('.pptx')) {
      return { icon: '📄', color: '#ffffff', bgColor: '#c41e3a' }; // Dark red
    }
    
    // Word documents - enhanced detection
    if (file.type.includes('document') || 
        file.type.includes('word') ||
        file.type === 'application/msword' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.doc') ||
        file.name.toLowerCase().endsWith('.docx')) {
      return { icon: '📄', color: '#ffffff', bgColor: '#4285f4' }; // Blue
    }
    
    // Excel files - enhanced detection
    if (file.type.includes('sheet') || 
        file.type.includes('excel') ||
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name.toLowerCase().endsWith('.xls') ||
        file.name.toLowerCase().endsWith('.xlsx')) {
      return { icon: '📄', color: '#ffffff', bgColor: '#34a853' }; // Green
    }
    
    // Text files - enhanced detection
    if (file.type.includes('text') || 
        file.type === 'text/plain' ||
        file.name.toLowerCase().endsWith('.txt') ||
        file.name.toLowerCase().endsWith('.rtf')) {
      return { icon: '📄', color: '#ffffff', bgColor: '#5dade2' }; // Light blue
    }
    
    // Default gray for unknown files
    return { icon: '📄', color: '#ffffff', bgColor: '#666' }; // Default gray
  };

  return (
    <div className="bg-chat-dark-bg border-t border-chat-dark-border">
      {/* File upload area when dragging */}
      {isDragActive && (
        <div className={`absolute inset-0 z-50 flex items-center justify-center ${
          isDragReject ? 'bg-red-500/20' : 'bg-sml-blue-500/20'
        } backdrop-blur-sm`}>
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-chat-dark-text" />
            <p className="text-lg font-medium text-chat-dark-text">
              {isDragReject ? 'File type not supported' : 'Drop files to upload'}
            </p>
            <p className="text-sm text-chat-dark-text-secondary">
              Images (JPG, PNG, GIF, WEBP, BMP) and Documents (PDF, DOCX)
            </p>
          </div>
        </div>
      )}

      <div {...getRootProps()} className="relative">
        <input {...getInputProps()} />
        
        {/* Selected files preview */}
        {selectedFiles.length > 0 && (
          <div className="px-4 py-3 border-b border-chat-dark-border">
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => {
                const previewUrl = createImagePreview(file);
                const iconStyle = getFileIconStyle(file);
                return (
                  <div key={index} className="flex items-center space-x-2 bg-chat-dark-secondary rounded-lg px-3 py-2">
                    {/* Show actual image thumbnail or colored document icon */}
                    {previewUrl ? (
                      <img 
                        src={previewUrl} 
                        alt={file.name}
                        className="w-8 h-8 object-cover rounded-lg"
                        onLoad={() => URL.revokeObjectURL(previewUrl)}
                      />
                    ) : (
                      <div className="w-8 h-8 flex items-center justify-center text-sm rounded-lg border" style={{
                        color: iconStyle.color,
                        backgroundColor: iconStyle.bgColor,
                        borderColor: '#ddd'
                      }}>
                        📄
                      </div>
                    )}
                    <span className="text-sm text-chat-dark-text truncate max-w-32">
                      {file.name}
                    </span>
                    <span className="text-xs text-chat-dark-text-secondary">
                      {(file.size / (1024 * 1024)).toFixed(1)}MB
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-chat-dark-text-secondary hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending uploads */}
        {pendingUploads.length > 0 && (
          <div className="px-4 py-3 border-b border-chat-dark-border">
            <div className="space-y-2">
              {pendingUploads.map((upload) => (
                <div key={upload.id} className="flex items-center space-x-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-chat-dark-text">{upload.file.name}</span>
                      <span className="text-xs text-chat-dark-text-secondary">
                        {upload.status === 'uploading' ? `${upload.progress}%` : upload.status}
                      </span>
                    </div>
                    <div className="w-full bg-chat-dark-tertiary rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          upload.status === 'error' ? 'bg-red-500' :
                          upload.status === 'completed' ? 'bg-green-500' :
                          'bg-sml-blue-500'
                        }`}
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="px-4 py-4">
          <div className="flex items-end space-x-3">
            {/* File upload button */}
            <button
              type="button"
              onClick={handleFileInputClick}
              disabled={disabled}
              className="flex-shrink-0 p-2 text-chat-dark-text-secondary hover:text-chat-dark-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Upload file"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Voice recording button */}
            <button
              type="button"
              onClick={toggleVoiceRecording}
              disabled={disabled}
              className={`flex-shrink-0 p-2 transition-colors ${
                isRecording 
                  ? 'text-red-400 hover:text-red-300' 
                  : 'text-chat-dark-text-secondary hover:text-chat-dark-text'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? 'Stop recording' : 'Start voice recording'}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Message input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleTextareaChange}
                onKeyPress={handleKeyPress}
                placeholder={isRecording ? 'Recording voice message...' : 'Type your message here...'}
                disabled={disabled || isRecording}
                className="w-full bg-chat-dark-secondary border border-chat-dark-border rounded-lg px-4 py-3 text-chat-dark-text placeholder-chat-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-sml-blue-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
              />
            </div>

            {/* Send button */}
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={(!message.trim() && selectedFiles.length === 0) || disabled || isLoading || pendingUploads.some(upload => upload.status === 'uploading' || upload.status === 'processing')}
              className="flex-shrink-0 p-2 bg-sml-blue-600 text-white rounded-lg hover:bg-sml-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-sml-blue-600 transition-colors"
              title={pendingUploads.some(upload => upload.status === 'uploading' || upload.status === 'processing') ? "Please wait for upload to complete" : "Send message"}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={Object.keys(supportedFileTypes).join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default ChatInput;
