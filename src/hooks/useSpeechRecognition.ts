"use client";

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
}

export const useSpeechRecognition = ({ onResult, onError }: UseSpeechRecognitionProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Use refs to avoid recreating recognition on callback changes
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      const errorMsg = "Speech recognition is not supported in your browser";
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
      return;
    }

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        setError(null);
        recognitionRef.current.start();
      }
    } catch (err: any) {
      const errorMsg = `Speech recognition error: ${err.message || 'Unknown error'}`;
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
      setIsListening(false);
    }
  }, [isListening]);

  // Setup recognition only once
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError("Speech Recognition API not supported in this browser.");
      return;
    }

    setIsSupported(true);
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      let errorMessage = 'Speech recognition error';
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error occurred during speech recognition';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone detected or microphone in use by another application';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      // Only process final results, send each segment independently
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript;
          if (transcript.trim()) {
            onResultRef.current(transcript);
          }
        }
      }
    };

    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { 
    isListening, 
    isSupported, 
    error, 
    toggleListening,
    cleanup 
  };
};