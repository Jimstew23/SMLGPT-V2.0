import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useHybridSpeech } from '../hooks/useHybridSpeech';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import VoiceSelector from './VoiceSelector';
import DocumentSelector from './DocumentSelector';
import SystemMessageWithThumbnail from './SystemMessageWithThumbnail';
import { Message, FileUpload } from '../types';
import apiService from '../services/api';

// Azure Speech credentials - you should move these to environment variables
const AZURE_SPEECH_KEY = process.env.REACT_APP_AZURE_SPEECH_KEY || 'AH4cl0zbpVMDJOaIjvAKWaJGzSNdkbSUxUh2NgKX6SL8NjLn8XWAJQQJ99BDACHYHv6XJ3w3AAAEACOGUCi9';
const AZURE_SPEECH_REGION = process.env.REACT_APP_AZURE_SPEECH_REGION || 'eastus2';

interface UploadResponse {
  status: string;
  file_id: string;
  blob_url: string;
  analysis: {
    extractedText: string;
  };
  processing_time_ms: number;
}

interface DocumentInfo {
  id: string;
  filename: string;
  type: string;
  size: number;
  uploadedAt: string;
  analysisResult: {
    extractedText: string;
  };
  processingTime: number;
}

const HybridChatInterface: React.FC = () => {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Welcome to SMLGPT V2.0! I can analyze safety scenarios using voice, text, or uploaded images/documents. You can also reference previously uploaded documents in our conversation. How can I help you stay safe today?',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>(''); // Added voice selection state
  
  // Document management state
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false); // Add upload state tracking
  const [uploadProgress, setUploadProgress] = useState<string>(''); // Add upload progress message
  
  // File cache for immediate thumbnail display
  const [fileCache, setFileCache] = useState<Map<string, string>>(new Map());

  // Speech integration
  const {
    // Recognition
    isRecording,
    recognizedText,
    startRecording,
    stopRecording,
    clearRecognizedText,
    
    // Synthesis
    isSpeaking,
    speakText,
    stopSpeaking,
    
    // Control
    useAzureSpeech,
    setUseAzureSpeech,
    nativeSpeechSupported,
    error: speechError
  } = useHybridSpeech(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Check API connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle recognized speech text
  useEffect(() => {
    if (recognizedText && !isRecording) {
      handleSendMessage(recognizedText);
      clearRecognizedText();
    }
  }, [recognizedText, isRecording]);

  // Display speech errors
  useEffect(() => {
    if (speechError) {
      toast.error(`Speech Error: ${speechError}`);
    }
  }, [speechError]);

  const checkConnection = async () => {
    try {
      const health = await apiService.getHealthStatus();
      setIsConnected(health.status === 'ok');
    } catch (error) {
      setIsConnected(false);
      toast.error('Failed to connect to SMLGPT backend');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string, files?: File[]) => {
    // If files are provided, upload them first (no automatic analysis)
    if (files && files.length > 0) {
      // Convert File[] to FileList for handleFileUpload
      const dt = new DataTransfer();
      files.forEach(file => dt.items.add(file));
      await handleFileUpload(dt.files);
      
      // Only send text message if provided, no automatic analysis
      if (content.trim()) {
        // Wait for upload to complete, then send the text message
        setTimeout(async () => {
          await sendTextMessage(content.trim());
        }, 1500);
      }
      // If no text provided, just upload the files and wait for user's next message
      return;
    }

    // No files provided, require text content
    if (!content.trim()) return;
    
    // No files, just send text message
    await sendTextMessage(content.trim());
  };

  const sendTextMessage = async (content: string) => {
    // DEBUG: Log current document selection state
    console.log('🔍 Chat Debug - Sending message:', content.substring(0, 50) + '...');
    console.log('🔍 Chat Debug - Uploaded documents:', uploadedDocuments.length);
    console.log('🔍 Chat Debug - Selected documents:', selectedDocuments);
    console.log('🔍 Chat Debug - Selected documents length:', selectedDocuments.length);
    
    // CRITICAL FIX: Ensure we always include the most recent uploaded image for Vision analysis
    let documentReferences = [...selectedDocuments];
    
    // If no documents are selected but we have uploaded documents, auto-select the most recent image
    if (documentReferences.length === 0 && uploadedDocuments.length > 0) {
      // Find the most recent uploaded image (for Vision analysis)
      const recentImages = uploadedDocuments
        .filter(doc => doc.type.startsWith('image/'))
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      
      if (recentImages.length > 0) {
        documentReferences = [recentImages[0].id];
        console.log('🔍 Chat Debug - Auto-selected recent image:', recentImages[0].filename);
        
        // Update selected documents state to reflect auto-selection
        setSelectedDocuments(documentReferences);
      }
    }
    
    console.log('🔍 Chat Debug - Final document references:', documentReferences);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await apiService.sendChatMessage(
        content,
        messages.filter(m => m.role !== 'system'),
        true,
        documentReferences // CRITICAL: Use the ensured document references
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        safetyAnalysis: response.analysis
      };

      setMessages(prev => [...prev, aiMessage]);

      // Auto-speak AI response if enabled
      if (autoSpeak && response.response) {
        speakText(response.response, selectedVoice);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your message. Please try again or check your connection.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced file upload handler with immediate thumbnail display
  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return;

    const file = files[0]; // Handle single file for ChatGPT-style UX
    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      // Create preview URL for immediate display
      const previewUrl = URL.createObjectURL(file);
      
      // Cache the preview URL
      setFileCache(prev => new Map(prev.set(file.name, previewUrl)));

      // Add system message with thumbnail immediately
      const systemMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: '',
        timestamp: new Date().toISOString(),
        component: (
          <SystemMessageWithThumbnail 
            file={{
              filename: file.name,
              type: file.type,
              previewUrl: previewUrl,
              size: file.size
            }}
          />
        )
      };

      setMessages(prev => [...prev, systemMessage]);

      // Upload to backend
      const response = await apiService.uploadFile(file) as UploadResponse;
      
      if (response.status === 'success') {
        // Update uploaded documents list for backend integration
        const newDocument: DocumentInfo = {
          id: response.file_id,
          filename: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          analysisResult: response.analysis,
          processingTime: response.processing_time_ms
        };

        setUploadedDocuments(prev => [...prev, newDocument]);
        
        // Auto-select the uploaded document for next message
        setSelectedDocuments([response.file_id]);

        toast.success(`File uploaded successfully: ${file.name}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload file: ${file.name}`);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
  };

  return (
    <div className="App">
      <Toaster position="top-right" />
      
      {/* Top Status Bar */}
      <div className="status-bar">
        <span><i className="fas fa-circle status-indicator"></i> {isConnected ? 'Connected' : 'Disconnected'}</span>
        <span>Auto-Speak: <i className={`fas ${autoSpeak ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i></span>
        <span>
          Speech Engine:
          <select>
            <option>Native API</option>
          </select>
        </span>
        <button className="icon-btn" onClick={toggleRecording}>
          <i className={`fas ${isRecording ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
        </button>
        <button className="icon-btn" onClick={() => setAutoSpeak(!autoSpeak)}>
          <i className={`fas ${autoSpeak ? 'fa-volume-up' : 'fa-volume-off'}`}></i>
        </button>
        <VoiceSelector
          selectedVoice={selectedVoice}
          onVoiceChange={(voice: string) => setSelectedVoice(voice)}
        />
        <button className="icon-btn">
          <i className="fas fa-cog"></i>
        </button>
      </div>

      {/* Green Header with Shimmering Title */}
      <header>
        <img src="/SML.png" alt="Save My Life Logo" className="logo"/>
        <div className="title">SMLGPT V2.0</div>
      </header>

      {/* Chat Content */}
      <div className="container">
        <div className="chat-container">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`message ${message.role} message-appear`}
            >
              {message.role === 'assistant' && (
                <img src="/SML.png" alt="SML logo" className="ai-small-logo"/>
              )}
              <div>
                {message.component ? (
                  message.component
                ) : (
                  <div className="bubble">
                    <ChatMessage
                      message={message}
                      onSpeakMessage={(text) => speakText(text, selectedVoice)}
                    />
                  </div>
                )}
                {message.role === 'assistant' && (
                  <div className="timestamp">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}
                {message.role === 'user' && (
                  <div className="timestamp">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
              {message.role === 'user' && (
                <div className="user-icon-container">
                  <div className="user-icon">
                    🟢
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="message ai">
              <img src="/SML.png" alt="SML logo" className="ai-small-logo"/>
              <div>
                <div className="bubble">
                  <div className="typing-indicator">
                    <span>Analyzing...</span>
                    <div className="typing-dots">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Example Attachments (when files are uploaded) */}
      {fileCache.size > 0 && (
        <div className="attachments">
          {Array.from(fileCache.entries()).map(([filename, url]) => (
            <div key={filename} className="attachment">
              <img src={url} alt={filename} className="thumb"/>
              <span>{filename}</span>
              <button 
                className="remove" 
                onClick={() => {
                  const newCache = new Map(fileCache);
                  newCache.delete(filename);
                  setFileCache(newCache);
                  URL.revokeObjectURL(url);
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Bar with Icons */}
      <div className="input-bar">
        <button className="icon-btn">
          <i className="fas fa-paperclip"></i>
        </button>
        <button className="icon-btn" onClick={toggleRecording}>
          <i className={`fas ${isRecording ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
        </button>
        <ChatInput
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          disabled={isLoading || isUploading}
          isLoading={isLoading}
          uploadProgress={uploadProgress}
        />
        <button className="icon-btn">
          <i className="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
};

export default HybridChatInterface;
