import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useHybridSpeech } from '../hooks/useHybridSpeech';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import VoiceSelector from './VoiceSelector';
import DocumentSelector from './DocumentSelector';
import SystemMessageWithThumbnail from './SystemMessageWithThumbnail';
import UploadProgressMessage from './UploadProgressMessage';
import { Message, FileUpload } from '../types';
import apiService from '../services/api';
import { compressImage, generateImageHash } from '../utils/imageUtils';
import { cacheService } from '../services/cacheService';

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
  cached?: boolean;
}

interface DocumentInfo {
  id: string;
  filename: string;
  type: string;
  size: number;
  blobUrl?: string;
  uploadedAt: string;
  analysisResult?: {
    extractedText: string;
  };
  processingTime?: number;
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
  
  // Upload progress tracking
  const [uploadStage, setUploadStage] = useState<'uploading' | 'processing' | 'analyzing' | 'complete' | 'error' | null>(null);
  const [currentUploadProgress, setCurrentUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string>('');
  const [currentUploadFilename, setCurrentUploadFilename] = useState<string>('');

  // File cache for immediate thumbnail display
  const [fileCache, setFileCache] = useState<Map<string, string>>(new Map());
  
  // Track thumbnail message IDs by filename to avoid duplicates
  const [thumbnailMessages, setThumbnailMessages] = useState<Map<string, string>>(new Map());

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
    // Add detailed debugging
    console.log('=== CHAT DEBUG START ===');
    console.log('📸 Uploaded documents:', uploadedDocuments);
    console.log('✅ Selected documents:', selectedDocuments);
    console.log('📝 Message content:', content);
    
    // Debug: Show all uploaded images
    const uploadedImages = uploadedDocuments.filter(doc => doc.type.startsWith('image/'));
    console.log('🖼️ Uploaded images:', uploadedImages);
    
    let documentReferences = [...selectedDocuments];
    
    // ENHANCED AUTO-SELECTION LOGIC
    if (documentReferences.length === 0 && uploadedDocuments.length > 0) {
        // Find the most recent uploaded image
        const recentImages = uploadedDocuments
            .filter(doc => doc.type.startsWith('image/'))
            .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        
        if (recentImages.length > 0) {
            documentReferences = [recentImages[0].id];
            console.log('🎯 Auto-selected image:', recentImages[0]);
            setSelectedDocuments(documentReferences);
        } else {
            console.warn('⚠️ No images found to auto-select');
        }
    }
    
    console.log('📤 Final document references being sent:', documentReferences);
    console.log('=== CHAT DEBUG END ===');

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

  // Enhanced file upload handler with compression, caching, and progress tracking
  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return;

    const file = files[0]; // Handle single file for ChatGPT-style UX
    setIsUploading(true);
    setUploadStage('uploading');
    setCurrentUploadProgress(0);
    setUploadError('');
    setCurrentUploadFilename(file.name);

    try {
      let processedFile = file;
      
      // Step 1: Image compression for large images
      if (file.type.startsWith('image/') && file.size > 500 * 1024) { // 500KB threshold
        setUploadStage('processing');
        setCurrentUploadProgress(10);
        
        try {
          processedFile = await compressImage(file);
          console.log(`Image compressed: ${file.size} → ${processedFile.size} bytes (${Math.round((1 - processedFile.size / file.size) * 100)}% reduction)`);
        } catch (compressionError) {
          console.warn('Image compression failed, using original:', compressionError);
          processedFile = file;
        }
      }

      // Step 2: Check cache for existing analysis
      if (file.type.startsWith('image/')) {
        const imageHash = await generateImageHash(file);
        const cachedResult = cacheService.getCachedAnalysis(imageHash);
        
        if (cachedResult) {
          console.log('Using cached analysis for image');
          setUploadStage('complete');
          setCurrentUploadProgress(100);
          
          // Create thumbnail message with cached data
          const previewUrl = URL.createObjectURL(file);
          const messageId = Date.now().toString();
          
          const systemMessage: Message = {
            id: messageId,
            role: 'system',
            content: `✅ File "${file.name}" uploaded successfully (cached result)`,
            timestamp: new Date().toISOString(),
            component: (
              <SystemMessageWithThumbnail 
                file={{
                  filename: file.name,
                  type: file.type,
                  previewUrl: previewUrl,
                  size: file.size,
                  isLoading: false
                }}
              />
            )
          };

          setMessages(prev => [...prev, systemMessage]);
          setThumbnailMessages(prev => new Map(prev.set(file.name, messageId)));
          
          // Update documents list
          const newDocument: DocumentInfo = {
            id: cachedResult.file_id || `cached-${Date.now()}`,
            filename: file.name,
            type: file.type,
            size: file.size,
            blobUrl: cachedResult.blob_url || previewUrl,
            uploadedAt: new Date().toISOString()
          };
          
          setUploadedDocuments(prev => [...prev, newDocument]);
          setTimeout(() => {
            setUploadStage(null);
            setIsUploading(false);
          }, 1000);
          return;
        }
      }

      // Step 3: Create preview URL for immediate display
      const previewUrl = URL.createObjectURL(file);
      setFileCache(prev => new Map(prev.set(file.name, previewUrl)));
      
      // Step 4: Add system message with thumbnail immediately
      const messageId = Date.now().toString();
      const systemMessage: Message = {
        id: messageId,
        role: 'system',
        content: '',
        timestamp: new Date().toISOString(),
        component: (
          <SystemMessageWithThumbnail 
            file={{
              filename: file.name,
              type: file.type,
              previewUrl: previewUrl,
              size: file.size,
              isLoading: true
            }}
          />
        )
      };

      setMessages(prev => [...prev, systemMessage]);
      setThumbnailMessages(prev => new Map(prev.set(file.name, messageId)));

      // Step 5: Upload with progress tracking
      setUploadStage('uploading');
      setCurrentUploadProgress(20);

      const response = await apiService.uploadFileWithProgress(processedFile, 'safety', {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 70) + 20; // 20-90%
          setCurrentUploadProgress(progress);
        }
      }) as UploadResponse;
      
      setUploadStage('analyzing');
      setCurrentUploadProgress(95);
      
      if (response.status === 'success') {
        // Cache the result
        if (file.type.startsWith('image/')) {
          const imageHash = await generateImageHash(file);
          cacheService.cacheAnalysis(imageHash, response);
        }
        
        // Update uploaded documents list
        const newDocument: DocumentInfo = {
          id: response.file_id,
          filename: file.name,
          type: file.type,
          size: file.size,
          blobUrl: response.blob_url,
          uploadedAt: new Date().toISOString()
        };
        
        setUploadedDocuments(prev => [...prev, newDocument]);
        
        // Update system message to remove loading state
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              content: `✅ File "${file.name}" uploaded and analyzed successfully${response.cached ? ' (cached)' : ''} - Processing time: ${response.processing_time_ms}ms`,
              component: (
                <SystemMessageWithThumbnail 
                  file={{
                    filename: file.name,
                    type: file.type,
                    previewUrl: previewUrl,
                    size: file.size,
                    isLoading: false
                  }}
                />
              )
            };
          }
          return msg;
        }));

        setUploadStage('complete');
        setCurrentUploadProgress(100);
        
        toast.success(`File uploaded successfully${response.cached ? ' (cached)' : ''}!`);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStage('error');
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Reset upload state after delay
      setTimeout(() => {
        setUploadStage(null);
        setCurrentUploadProgress(0);
        setIsUploading(false);
        setUploadError('');
      }, 2000);
    }
  };

  // toggleRecording function moved below to avoid duplicate declaration

  const toggleSpeech = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
  };
  
  // Toggle voice recording on/off
  const toggleRecording = () => {
    console.log('Toggling recording state:', isRecording ? 'stopping' : 'starting');
    try {
      if (isRecording) {
        stopRecording();
        toast.success('Voice recording stopped');
      } else {
        // Request microphone permissions first
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            startRecording();
            toast.success('Voice recording started');
          })
          .catch(err => {
            console.error('Microphone permission error:', err);
            toast.error(`Microphone access denied: ${err.message}`);
          });
      }
    } catch (error) {
      console.error('Speech toggling error:', error);
      toast.error(`Speech error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };



  return (
    <div className="App">
      <Toaster position="top-right" />
      
      {/* Top Status Bar */}
      <div className="status-bar">
        <span>
          <i className={`fas fa-circle status-indicator ${isConnected ? 'connected' : ''}`}></i> 
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        
        <div className="speech-controls">
          <button 
            className={`icon-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <i className={`fas ${isRecording ? 'fa-stop-circle' : 'fa-microphone'}`}></i>
            {isRecording && <span className="recording-text">Recording...</span>}
          </button>
          
          <button 
            className={`icon-btn ${autoSpeak ? 'active' : ''}`} 
            onClick={() => setAutoSpeak(!autoSpeak)}
            title={autoSpeak ? 'Disable auto-speak' : 'Enable auto-speak'}
          >
            <i className={`fas ${autoSpeak ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
          </button>
          
          {isSpeaking && (
            <button 
              className="icon-btn stop-speaking"
              onClick={stopSpeaking}
              title="Stop speaking"
            >
              <i className="fas fa-stop"></i>
            </button>
          )}
        </div>
        
        <VoiceSelector
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
        />
      </div>

      {/* Green Header with Shimmering Title */}
      <header>
        <img src="/SML.png" alt="Save My Life Logo" className="logo"/>
        <div className="title">SMLGPT V2.0</div>
      </header>

      {/* Chat Content */}
      <div className="container">
        <div className="chat-container">
          {/* Upload Progress Display */}
          {uploadStage && (
            <div className="upload-progress-container">
              <UploadProgressMessage
                stage={uploadStage}
                progress={currentUploadProgress}
                error={uploadError}
                filename={currentUploadFilename}
              />
            </div>
          )}
          
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
        <ChatInput
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          onVoiceRecording={toggleRecording}
          isLoading={isLoading}
          disabled={!isConnected}
          isRecording={isRecording}
          isUploading={isUploading}
          pendingUploads={[
            ...uploadedDocuments.map(doc => ({
              id: doc.id,
              name: doc.filename,
              type: doc.type,
              size: doc.size,
              file: new File([], doc.filename, { type: doc.type }),
              status: isUploading ? ('uploading' as const) : ('completed' as const)
            })),
            ...(isUploading ? [{
              id: 'uploading',
              name: uploadProgress || 'Uploading...',
              type: 'uploading',
              size: 0,
              file: new File([], 'uploading'),
              status: 'uploading' as const,
              progress: 50
            }] : [])
          ]}
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
