import { useState, useCallback, useRef } from 'react';

// Azure Speech SDK types
interface SpeechConfig {
  subscriptionKey: string;
  region: string;
}

interface AudioConfig {
  fromDefaultMicrophoneInput(): AudioConfig;
}

interface SpeechRecognizer {
  recognizeOnceAsync(callback: (result: any) => void): void;
  close(): void;
}

interface SpeechSynthesizer {
  speakTextAsync(text: string, callback?: (result: any) => void, errorCallback?: (error: any) => void): void;
  close(): void;
}

export const useAzureSpeech = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const synthesizerRef = useRef<SpeechSynthesizer | null>(null);

  const startRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        setIsRecording(true);
        
        // Fallback to native Web Speech API if Azure SDK not available
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = 'en-US';
          
          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setIsRecording(false);
            resolve(transcript);
          };
          
          recognition.onerror = (event: any) => {
            setIsRecording(false);
            reject(new Error(`Speech recognition error: ${event.error}`));
          };
          
          recognition.start();
        } else {
          setIsRecording(false);
          reject(new Error('Speech recognition not supported'));
        }
      } catch (error) {
        setIsRecording(false);
        reject(error);
      }
    });
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recognizerRef.current) {
      recognizerRef.current.close();
      recognizerRef.current = null;
    }
  }, []);

  const speak = useCallback(async (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        setIsSpeaking(true);
        
        // Fallback to native Web Speech API if Azure SDK not available
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          utterance.rate = 1;
          utterance.pitch = 1;
          
          utterance.onend = () => {
            setIsSpeaking(false);
            resolve();
          };
          
          utterance.onerror = (event) => {
            setIsSpeaking(false);
            reject(new Error(`Speech synthesis error: ${event.error}`));
          };
          
          speechSynthesis.speak(utterance);
        } else {
          setIsSpeaking(false);
          reject(new Error('Speech synthesis not supported'));
        }
      } catch (error) {
        setIsSpeaking(false);
        reject(error);
      }
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    if (synthesizerRef.current) {
      synthesizerRef.current.close();
      synthesizerRef.current = null;
    }
  }, []);

  return {
    isRecording,
    isSpeaking,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking
  };
};

export default useAzureSpeech;
