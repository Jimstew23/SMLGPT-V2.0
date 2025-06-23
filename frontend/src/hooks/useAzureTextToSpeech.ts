import { useState, useEffect, useRef } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

interface UseAzureTextToSpeechReturn {
  isSpeaking: boolean;
  error: string | null;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
}

export const useAzureTextToSpeech = (
  subscriptionKey: string,
  region: string
): UseAzureTextToSpeechReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const synthesizer = useRef<SpeechSDK.SpeechSynthesizer | null>(null);

  useEffect(() => {
    if (!subscriptionKey || !region) {
      setError('Azure Speech subscription key and region are required');
      return;
    }

    try {
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
      speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';
      
      synthesizer.current = new SpeechSDK.SpeechSynthesizer(speechConfig);

      // Handle synthesis events
      synthesizer.current.synthesisStarted = () => {
        setIsSpeaking(true);
        setError(null);
      };

      synthesizer.current.synthesisCompleted = () => {
        setIsSpeaking(false);
      };

      synthesizer.current.SynthesisCanceled = (sender: any, e: any) => {
        console.error('Azure TTS canceled:', e);
        setError(`Speech synthesis canceled: ${e.reason || 'Unknown error'}`);
        setIsSpeaking(false);
      };

    } catch (err) {
      setError(`Failed to initialize Azure TTS: ${err}`);
    }

    return () => {
      if (synthesizer.current) {
        synthesizer.current.close();
        synthesizer.current = null;
      }
    };
  }, [subscriptionKey, region]);

  const speakText = (text: string) => {
    if (synthesizer.current && text && !isSpeaking) {
      setError(null);
      synthesizer.current.speakTextAsync(
        text,
        () => {
          setIsSpeaking(false);
          console.log('Azure TTS completed');
        },
        (err) => {
          setError(`Speech synthesis failed: ${err}`);
          setIsSpeaking(false);
          console.error('Azure TTS error:', err);
        }
      );
      setIsSpeaking(true);
    }
  };

  const stopSpeaking = () => {
    if (synthesizer.current && isSpeaking) {
      synthesizer.current.close();
      setIsSpeaking(false);
    }
  };

  return {
    isSpeaking,
    error,
    speakText,
    stopSpeaking
  };
};
