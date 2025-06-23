import { useState, useEffect, useRef, useCallback } from 'react';
import { useAzureSpeechRecognition } from './useAzureSpeechRecognition';
import { useAzureTextToSpeech } from './useAzureTextToSpeech';

// TypeScript declarations for Web Speech API (simplified)
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Check if native Web Speech API is supported
const NATIVE_SPEECH_SUPPORTED = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const SpeechSynthesis = (window as any).speechSynthesis;

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

  // Refs for native APIs
  const recognition = useRef<any>(null);
  const currentUtterance = useRef<any>(null);

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

  // Initialize native speech recognition
  useEffect(() => {
    if (!useAzureSpeech && SpeechRecognition) {
      try {
        recognition.current = new SpeechRecognition();
        recognition.current.lang = 'en-US';
        recognition.current.interimResults = false;
        recognition.current.maxAlternatives = 1;
        recognition.current.continuous = true;

        recognition.current.onresult = (event: any) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          setRecognizedText(prev => (prev ? prev + ' ' : '') + transcript);
          setError(null);
        };

        recognition.current.onerror = (event: any) => {
          console.error('Native speech recognition error:', event.error);
          setError(`Speech recognition error: ${event.error}`);
          setIsRecording(false);
        };

        recognition.current.onend = () => {
          setIsRecording(false);
        };

        recognition.current.onstart = () => {
          setIsRecording(true);
          setError(null);
        };

      } catch (err) {
        setError(`Failed to initialize native speech recognition: ${err}`);
      }
    }

    return () => {
      if (recognition.current) {
        recognition.current.stop();
        recognition.current = null;
      }
    };
  }, [useAzureSpeech]);

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
    setError(null);
    
    if (useAzureSpeech) {
      startAzureRecognition();
    } else if (recognition.current && !isRecording) {
      try {
        recognition.current.start();
      } catch (err) {
        setError(`Failed to start native recognition: ${err}`);
      }
    }
  }, [useAzureSpeech, isRecording, startAzureRecognition]);

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
        const voice = voices.find((v: any) => v.voiceURI === selectedVoiceURI);
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
      utterance.onerror = (event: any) => {
        console.error('Native TTS error:', event);
        setError(`Text-to-speech error: ${event.error}`);
        setIsSpeaking(false);
      };

      currentUtterance.current = utterance;
      SpeechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  }, [useAzureSpeech, azureSpeakText]);

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
