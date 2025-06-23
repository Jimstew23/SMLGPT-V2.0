import { useState, useRef, useCallback } from 'react';
import apiService from '../services/api';

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  clearTranscript: () => void;
}

export const useVoiceRecording = (): UseVoiceRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm;codecs=opus' 
        });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Process the recording
        await processRecording(audioBlob);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);

    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || 'Failed to access microphone');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const processRecording = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Convert webm to wav if needed for better compatibility
      const wavBlob = await convertToWav(audioBlob);
      
      // Send to speech-to-text API
      const result = await apiService.speechToText(wavBlob);
      
      if (result.transcript) {
        setTranscript(result.transcript);
      } else {
        setError('No speech detected in recording');
      }

    } catch (err: any) {
      console.error('Failed to process recording:', err);
      setError(apiService.handleError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const convertToWav = async (webmBlob: Blob): Promise<Blob> => {
    // For now, return the original blob
    // In production, you might want to use a library like lamejs or similar
    // to convert to a more widely supported format
    return webmBlob;
  };

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isRecording,
    isProcessing,
    transcript,
    error,
    startRecording,
    stopRecording,
    clearTranscript
  };
};
