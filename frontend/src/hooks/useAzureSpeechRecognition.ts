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

  useEffect(() => {
    if (!subscriptionKey || !region) {
      setError('Azure Speech subscription key and region are required');
      return;
    }

    try {
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
      speechConfig.speechRecognitionLanguage = 'en-US';
      
      speechRecognizer.current = new SpeechSDK.SpeechRecognizer(speechConfig);

      // Handle recognition events
      speechRecognizer.current.recognizing = (s, e) => {
        // Optional: Handle interim results
        console.log('Recognizing:', e.result.text);
      };

      speechRecognizer.current.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          setRecognizedText(prev => (prev ? prev + ' ' : '') + e.result.text);
          setError(null);
        }
      };

      speechRecognizer.current.canceled = (s, e) => {
        console.error('Azure Speech recognition canceled:', e);
        setError(`Recognition canceled: ${e.errorDetails}`);
        setIsRecording(false);
      };

      speechRecognizer.current.sessionStopped = (s, e) => {
        setIsRecording(false);
      };

    } catch (err) {
      setError(`Failed to initialize Azure Speech: ${err}`);
    }

    return () => {
      if (speechRecognizer.current) {
        speechRecognizer.current.close();
        speechRecognizer.current = null;
      }
    };
  }, [subscriptionKey, region]);

  const startRecognition = () => {
    if (speechRecognizer.current && !isRecording) {
      setError(null);
      setIsRecording(true);
      speechRecognizer.current.startContinuousRecognitionAsync(
        () => {
          console.log('Azure Speech recognition started');
        },
        (err) => {
          setError(`Failed to start recognition: ${err}`);
          setIsRecording(false);
        }
      );
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
