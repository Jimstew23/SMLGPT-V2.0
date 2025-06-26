import React, { useState, useEffect } from 'react';
import './App.css';
import { useHybridSpeech } from './hooks/useHybridSpeech';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import VoiceSelector from './components/VoiceSelector';
import SystemMessageWithThumbnail from './components/SystemMessageWithThumbnail';
import { Message } from './types';
import apiService from './services/api';
import { getFileIconStyle, createImagePreview } from './utils/fileIconUtils';

// Azure Speech credentials - move to env vars
const AZURE_SPEECH_KEY = process.env.REACT_APP_AZURE_SPEECH_KEY || 'AH4cl0zbpVMDJOaIjvAKWaJGzSNdkbSUxUh2NgKX6SL8NjLn8XWAJQQJ99BDACHYHv6XJ3w3AAAEACOGUCi9';
const AZURE_SPEECH_REGION = process.env.REACT_APP_AZURE_SPEECH_REGION || 'eastus2';

interface UploadedFile {
  file_id: string;
  filename: string;
  type: string;
  previewUrl?: string;
  blobUrl?: string;
  size?: number;
}

function App() {
  // AI Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]); // Track uploaded file IDs
  const [isConnected, setIsConnected] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false);
  
  // Speech functionality with correct parameters
  const { speakText, stopSpeaking } = useHybridSpeech(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);

  // Check backend connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const health = await apiService.getHealthStatus();
        setIsConnected(health.status === 'healthy');
      } catch (error) {
        setIsConnected(false);
      }
    };
    checkConnection();
  }, []);

  // Handle file uploads
  const handleFileUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    setPendingUploads(prev => [...prev, ...fileArray]);
    
    try {
      for (const file of fileArray) {
        const response = await apiService.uploadFile(file);
        setUploadedFileIds(prev => [...prev, response.file_id]);
        
        const uploadedFile: UploadedFile = {
          file_id: response.file_id,
          filename: file.name,
          type: file.type,
          previewUrl: createImagePreview(file),
          blobUrl: URL.createObjectURL(file),
          size: file.size
        };
        
        // Add system message immediately after upload
        const systemMessage: Message = {
          id: `system_${Date.now()}`,
          role: 'system',
          content: `✅ Your file **${file.name}** is uploaded and ready. What would you like me to do with it?`,
          timestamp: new Date().toISOString(),
          file: {
            name: file.name,
            type: file.type,
            previewUrl: uploadedFile.previewUrl || '',
            size: file.size
          }
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  // Handle sending messages
  const handleSendMessage = async (content: string, files: File[] = []) => {
    if (!content.trim() && files.length === 0) return;

    // Clear pending uploads if files were included
    if (files.length > 0) {
      setPendingUploads([]);
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Handle file uploads first if any
      if (files.length > 0) {
        for (const file of files) {
          await apiService.uploadFile(file);
        }
      }

      // Send chat message using correct API method
      const response = await apiService.sendChatMessage(
        content, 
        messages, 
        true, 
        uploadedFileIds // Pass uploaded file IDs as document references
      );
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Auto-speak AI response if enabled
      if (autoSpeakEnabled && response.response) {
        speakText(response.response, selectedVoice);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      {/* Top Status Bar */}
      <div className="status-bar">
        <span><i className="fas fa-circle status-indicator"></i> {isConnected ? 'Connected' : 'Disconnected'}</span>
        <span>Auto-Speak: <i className={`fas ${autoSpeakEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}`} onClick={() => setAutoSpeakEnabled(!autoSpeakEnabled)} style={{cursor: 'pointer'}}></i></span>
        <span>
          Speech Engine:
          <select><option>Native API</option></select>
        </span>
        <button className="icon-btn" onClick={() => {/* TODO: Add microphone functionality */}}><i className="fas fa-microphone"></i></button>
        <button className="icon-btn" onClick={stopSpeaking}><i className="fas fa-volume-off"></i></button>
        <button className="icon-btn"><i className="fas fa-volume-up"></i></button>
        <VoiceSelector selectedVoice={selectedVoice} onVoiceChange={setSelectedVoice} />
        <button className="icon-btn"><i className="fas fa-cog"></i></button>
      </div>

      {/* Green Header */}
      <header>
        <img src="/SML.png" alt="Save My Life Logo" className="logo"/>
        <div className="title">SMLGPT V2.0</div>
      </header>

      {/* Chat Content */}
      <div className="container">
        <div className="chat-container">
          {messages.map((message) => (
            message.role === 'system' && message.file ? (
              <SystemMessageWithThumbnail 
                key={message.id} 
                file={{
                  filename: message.file.name,
                  type: message.file.type,
                  previewUrl: message.file.previewUrl,
                  size: message.file.size
                }} 
              />
            ) : (
              <ChatMessage key={message.id} message={message} />
            )
          ))}
          {isLoading && (
            <div className="message ai">
              <img src="/SML.png" alt="SML logo" className="ai-small-logo"/>
              <div>
                <div className="bubble">Thinking...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attachments area - will show when files are uploaded */}
      <div className="attachments" style={{display: pendingUploads.length > 0 ? 'flex' : 'none'}}>
        {pendingUploads.map((file, index) => {
          const previewUrl = createImagePreview(file);
          const iconStyle = getFileIconStyle(file);
          return (
            <div key={index} className="attachment">
              {/* Show actual image thumbnail or colored document icon */}
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt={file.name}
                  className="thumb"
                  onLoad={() => URL.revokeObjectURL(previewUrl)}
                />
              ) : (
                <div className="thumb" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: iconStyle.color,
                  backgroundColor: iconStyle.bgColor,
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}>
                  📄
                </div>
              )}
              <span>{file.name}</span>
              <button className="remove" onClick={() => setPendingUploads(prev => prev.filter((_, i) => i !== index))}>
                <i className="fas fa-times"></i>
              </button>
            </div>
          );
        })}
      </div>

      {/* Input Bar with Icons */}
      <ChatInput 
        onSendMessage={handleSendMessage}
        onFileUpload={handleFileUpload}
        disabled={isLoading}
      />
    </div>
  );
}

export default App;
