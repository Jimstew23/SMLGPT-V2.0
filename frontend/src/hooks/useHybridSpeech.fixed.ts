import { useState, useEffect, useRef, useCallback } from 'react';
import { useAzureSpeechRecognition } from './useAzureSpeechRecognition';
import { useAzureTextToSpeech } from './useAzureTextToSpeech';

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Check if native Web Speech API is supported
const NATIVE_SPEECH_SUPPORTED = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const SpeechSynthesis = (window as any).speechSynthesis;

// Types for speech recognition events
interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
      isFinal?: boolean;
    };
  };
}

interface SpeechErrorEvent {
  error: string;
  message?: string;
}

interface UseHybridSpeechReturn {
  // Recognition
  isRecording: boolean;
  recognizedText: string;
  startRecording: () => void;
  stopRecording: () => void;
  clearRecognizedText: () => void;
  
  // Synthesis  
  isSpeaking: boolean;
  speakText: (text: string, selectedVoiceURI?: string) => void;
  stopSpeaking: () => void;
  
  // Control
  useAzureSpeech: boolean;
  setUseAzureSpeech: (use: boolean) => void;
  nativeSpeechSupported: boolean;
  error: string | null;
}

export const useHybridSpeech = (
  azureSubscriptionKey: string,
  azureRegion: string
): UseHybridSpeechReturn => {
  // State
  const [useAzureSpeech, setUseAzureSpeech] = useState(!NATIVE_SPEECH_SUPPORTED);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Debug logging
  const logDebug = (message: string, data?: any) => {
    console.log(`[HybridSpeech] ${message}`, data || '');
  };
  
  // On component mount, log speech configuration
  useEffect(() => {
    logDebug(`Speech initialization`, {
      nativeSpeechSupported: NATIVE_SPEECH_SUPPORTED,
      usingAzureSpeech: useAzureSpeech,
      azureKeyAvailable: !!azureSubscriptionKey,
      azureRegionAvailable: !!azureRegion
    });
  }, [useAzureSpeech, azureSubscriptionKey, azureRegion]);

  // Refs for native APIs
  const recognition = useRef<any>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);

  // Azure Speech hooks
  const {
    isRecording: azureRecording,
    recognizedText: azureText,
    error: azureRecognitionError,
    startRecognition: startAzureRecognition,
    stopRecognition: stopAzureRecognition,
    clearText: clearAzureText
  } = useAzureSpeechRecognition(azureSubscriptionKey, azureRegion);

  const {
    isSpeaking: azureSpeaking,
    error: azureSpeechError,
    speakText: azureSpeakText,
    stopSpeaking: stopAzureSpeaking
  } = useAzureTextToSpeech(azureSubscriptionKey, azureRegion);

  // Check for speech recognition support and permission status
  const checkMicrophonePermissions = useCallback(async () => {
    try {
      // Query permissions API if available
      if (navigator.permissions) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        logDebug(`Microphone permission status: ${permissionStatus.state}`);
        return permissionStatus.state === 'granted';
      }
      return false;
    } catch (err) {
      logDebug(`Error checking microphone permissions: ${err}`);
      return false;
    }
  }, []);

  // Initialize native speech recognition
  useEffect(() => {
    if (!useAzureSpeech && NATIVE_SPEECH_SUPPORTED) {
      const initializeSpeechRecognition = async () => {
        try {
          logDebug('Initializing speech recognition');
          
          // Check if browser supports speech recognition
          if (SpeechRecognitionClass) {
            recognition.current = new SpeechRecognitionClass();
            recognition.current.continuous = true;
            recognition.current.interimResults = true;
            recognition.current.lang = 'en-US'; // Set language explicitly
            
            // Check for permissions
            const hasPermissions = await checkMicrophonePermissions();
            logDebug(`Has microphone permissions: ${hasPermissions}`);

            // Configure recognition event handlers
            recognition.current.onstart = () => {
              logDebug('Native recognition started');
              setIsRecording(true);
              setError(null);
            };
            
            recognition.current.onresult = (event: SpeechRecognitionEvent) => {
              // Use Object.keys to get indices and convert results to array safely
              const results = Object.keys(event.results).map(i => event.results[Number(i)]);
              const transcript = results
                .map(result => {
                  if (result && result[0]) {
                    return result[0].transcript;
                  }
                  return '';
                })
                .join('');
              
              logDebug(`Transcript received: ${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''}`);
              setRecognizedText(transcript);
            };

            recognition.current.onerror = (event: SpeechErrorEvent) => {
              logDebug(`Speech recognition error: ${event.error}`);
              setError(`Error in speech recognition: ${event.error}`);
              setIsRecording(false);
            };

            recognition.current.onend = () => {
              logDebug('Native recognition ended');
              setIsRecording(false);
            };
            
            logDebug('Speech recognition initialized successfully');
          } else {
            logDebug('Speech recognition not supported in this browser');
            setError('Speech recognition not supported in this browser');
          }
        } catch (err) {
          logDebug(`Error initializing speech recognition: ${err}`);
          setError(`Failed to initialize native speech recognition: ${err}`);
        }
      };
      
      initializeSpeechRecognition();
      
      return () => {
        if (recognition.current) {
          logDebug('Cleaning up speech recognition');
          try {
            if (isRecording) {
              recognition.current.stop();
            }
          } catch (err) {
            logDebug(`Error stopping speech recognition during cleanup: ${err}`);
          }
        }
      };
    }
  }, [useAzureSpeech, checkMicrophonePermissions, isRecording]);

  // Sync Azure states
  useEffect(() => {
    if (useAzureSpeech) {
      setIsRecording(azureRecording);
      setIsSpeaking(azureSpeaking);
      setError(azureRecognitionError || azureSpeechError);
    }
  }, [useAzureSpeech, azureRecording, azureSpeaking, azureRecognitionError, azureSpeechError]);

  // Sync Azure recognized text
  useEffect(() => {
    if (useAzureSpeech && azureText) {
      setRecognizedText(azureText);
    }
  }, [useAzureSpeech, azureText]);

  // Speech Recognition Methods
  const startRecording = useCallback(() => {
    logDebug(`Attempting to start recording. Using Azure: ${useAzureSpeech}`);
    
    if (useAzureSpeech) {
      logDebug('Starting Azure recognition');
      startAzureRecognition();
    } else if (recognition.current) {
      try {
        logDebug('Starting browser speech recognition');
        // Request microphone permission explicitly
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            logDebug('Microphone permission granted');
            try {
              recognition.current.start();
              logDebug('Native recognition started');
            } catch (err) {
              console.error('Failed to start native speech recognition:', err);
              setError(`Failed to start recording: ${err}`);
              logDebug('Native recognition error', err);
            }
          })
          .catch(err => {
            console.error('Microphone permission denied:', err);
            setError(`Microphone access denied: ${err.message}`);
            logDebug('Microphone permission error', err);
          });
      } catch (err) {
        console.error('Failed to start native speech recognition:', err);
        setError(`Failed to start recording: ${err}`);
        logDebug('Native recognition setup error', err);
      }
    } else {
      setError('Speech recognition not available');
      logDebug('Speech recognition not available');
    }
  }, [useAzureSpeech, startAzureRecognition]);

  const stopRecording = useCallback(() => {
    if (useAzureSpeech) {
      stopAzureRecognition();
    } else if (recognition.current && isRecording) {
      recognition.current.stop();
    }
  }, [useAzureSpeech, isRecording, stopAzureRecognition]);

  const clearRecognizedText = useCallback(() => {
    setRecognizedText('');
    setError(null);
    if (useAzureSpeech) {
      clearAzureText();
    }
  }, [useAzureSpeech, clearAzureText]);

  // Text-to-Speech Methods
  const sanitizeTextForSpeech = useCallback((text: string): string => {
    return text
      // Remove markdown formatting
      .replace(/\*+/g, '') // Remove asterisks (*, **, ***)
      .replace(/#\w+/g, '') // Remove hashtags completely
      .replace(/["']/g, '') // Remove quotation marks
      .replace(/`+/g, '') // Remove backticks
      .replace(/\[.*?\]/g, '') // Remove [text] markdown links
      // Skip standalone underscores and underscore patterns
      .replace(/\b_+\b/g, '')
      .replace(/_/g, ' ')
      // CRITICAL FIX: Remove "logo" references for better speech
      .replace(/\s+logo\b/gi, '') // Remove "logo" word (e.g., "stop sign logo" → "stop sign")
      .replace(/\blogs?\b/gi, '') // Remove "log" or "logs" if they appear alone
      // Convert common abbreviations to spoken equivalents
      .replace(/\be\.g\.\b/gi, 'for example')
      .replace(/\beg\b/gi, 'for example')
      .replace(/\bi\.e\.\b/gi, 'that is')
      .replace(/\betc\.\b/gi, 'and so on')
      .replace(/\bvs\.\b/gi, 'versus')
      .replace(/\bw\/\b/gi, 'with')
      .replace(/\bw\/o\b/gi, 'without')
      // Convert symbols to words
      .replace(/&/g, ' and ')
      .replace(/%/g, ' percent ')
      .replace(/\$/g, ' dollars ')
      .replace(/@/g, ' at ')
      // Clean up excessive punctuation
      .replace(/[,]{2,}/g, ',')
      .replace(/[.]{2,}/g, '.')
      .replace(/[!]{2,}/g, '!')
      .replace(/[?]{2,}/g, '?')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const speakText = useCallback((text: string, selectedVoiceURI?: string) => {
    if (!text.trim()) return;
    
    // Sanitize text for natural speech
    const cleanText = sanitizeTextForSpeech(text);
    
    setError(null);
    
    if (useAzureSpeech) {
      azureSpeakText(cleanText);
    } else if (SpeechSynthesis) {
      // Stop any current speech
      if (currentUtterance.current) {
        SpeechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Use selected voice if provided
      if (selectedVoiceURI) {
        const voices = SpeechSynthesis.getVoices();
        const voice = voices.find((v: SpeechSynthesisVoice) => v.voiceURI === selectedVoiceURI);
        if (voice) {
          utterance.voice = voice;
        }
      }
      
      utterance.lang = 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        console.error('Native TTS error:', event);
        setError(`Text-to-speech error: ${event.error}`);
        setIsSpeaking(false);
      };

      currentUtterance.current = utterance;
      SpeechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  }, [useAzureSpeech, azureSpeakText, sanitizeTextForSpeech]);

  const stopSpeaking = useCallback(() => {
    if (useAzureSpeech) {
      stopAzureSpeaking();
    } else if (SpeechSynthesis && isSpeaking) {
      SpeechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [useAzureSpeech, isSpeaking, stopAzureSpeaking]);

  return {
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
    nativeSpeechSupported: NATIVE_SPEECH_SUPPORTED,
    error
  };
};
