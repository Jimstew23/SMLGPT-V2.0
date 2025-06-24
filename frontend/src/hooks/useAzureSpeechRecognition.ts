import { useState, useEffect, useRef } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

interface UseAzureSpeechRecognitionReturn {
  isRecording: boolean;
  recognizedText: string;
  error: string | null;
  startRecognition: () => void;
  stopRecognition: () => void;
  clearText: () => void;
}

export const useAzureSpeechRecognition = (
  subscriptionKey: string,
  region: string
): UseAzureSpeechRecognitionReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const speechRecognizer = useRef<SpeechSDK.SpeechRecognizer | null>(null);

  // Debug logging
  const logDebug = (message: string, data?: any) => {
    console.log(`🔊 Azure Speech: ${message}`, data || '');
  };

  useEffect(() => {
    logDebug(`Initializing with key=${subscriptionKey ? subscriptionKey.substring(0, 4) + '...' : 'missing'}, region=${region || 'missing'}`);
    
    if (!subscriptionKey || !region) {
      const errorMsg = 'Azure Speech subscription key and region are required';
      setError(errorMsg);
      logDebug(`Error: ${errorMsg}`);
      return;
    }

    try {
      logDebug('Creating speech config');
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
      speechConfig.speechRecognitionLanguage = 'en-US';
      
      logDebug('Creating speech recognizer');
      // Use default microphone for audio input
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      speechRecognizer.current = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

      // Handle recognition events
      speechRecognizer.current.recognizing = (s, e) => {
        // Handle interim results
        logDebug(`Recognizing interim: "${e.result.text}"`);
      };

      speechRecognizer.current.recognized = (s, e) => {
        // Log all recognition results with reason codes
        logDebug(`Recognition result: reason=${e.result.reason}, text="${e.result.text}"`);
        
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          logDebug('Successfully recognized speech');
          setRecognizedText(prev => (prev ? prev + ' ' : '') + e.result.text);
          setError(null);
        } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
          logDebug('No speech could be recognized');
        }
      };

      speechRecognizer.current.canceled = (s, e) => {
        const errorMessage = `Recognition canceled: ${e.errorDetails}`;
        console.error('Azure Speech recognition canceled:', e);
        logDebug(`Canceled: ${e.reason} - ${e.errorDetails}`);
        setError(errorMessage);
        setIsRecording(false);
      };

      speechRecognizer.current.sessionStopped = (s, e) => {
        logDebug('Session stopped');
        setIsRecording(false);
      };
      
      // Add connection status logging
      logDebug('Speech recognizer created and configured');
      
      // Log connection status on first initialization
      setTimeout(() => {
        try {
          // Test speech connection by checking recognizer properties
          if (speechRecognizer.current) {
            logDebug('Speech recognizer ready for use');
          }
        } catch (err) {
          logDebug('Error checking speech connection', err);
        }
      }, 500);

    } catch (err) {
      const errorMsg = `Failed to initialize Azure Speech: ${err}`;
      console.error(errorMsg, err);
      logDebug(`Initialization error: ${err}`, err);
      setError(errorMsg);
    }

    return () => {
      if (speechRecognizer.current) {
        speechRecognizer.current.close();
        speechRecognizer.current = null;
      }
    };
  }, [subscriptionKey, region]);

  const startRecognition = () => {
    logDebug('Attempting to start recognition');
    if (!speechRecognizer.current) {
      const errorMsg = 'Speech recognizer not initialized';
      logDebug(errorMsg);
      setError(errorMsg);
      return;
    }
    
    if (isRecording) {
      logDebug('Already recording, ignoring start request');
      return;
    }
    
    setError(null);
    setIsRecording(true);
    
    try {
      // Check microphone permissions explicitly first
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          logDebug('Microphone permission granted, starting recognition');
          
          speechRecognizer.current!.startContinuousRecognitionAsync(
            () => {
              logDebug('Azure Speech recognition started successfully');
            },
            (err) => {
              const errorMsg = `Failed to start recognition: ${err}`;
              logDebug(errorMsg, err);
              setError(errorMsg);
              setIsRecording(false);
            }
          );
        })
        .catch(err => {
          const errorMsg = `Microphone access denied: ${err.message}`;
          logDebug(errorMsg, err);
          setError(errorMsg);
          setIsRecording(false);
        });
    } catch (err) {
      const errorMsg = `Error starting speech recognition: ${err}`;
      logDebug(errorMsg, err);
      setError(errorMsg);
      setIsRecording(false);
    }
  };

  const stopRecognition = () => {
    if (speechRecognizer.current && isRecording) {
      speechRecognizer.current.stopContinuousRecognitionAsync(
        () => {
          setIsRecording(false);
          console.log('Azure Speech recognition stopped');
        },
        (err) => {
          setError(`Failed to stop recognition: ${err}`);
          setIsRecording(false);
        }
      );
    }
  };

  const clearText = () => {
    setRecognizedText('');
    setError(null);
  };

  return {
    isRecording,
    recognizedText,
    error,
    startRecognition,
    stopRecognition,
    clearText
  };
};
