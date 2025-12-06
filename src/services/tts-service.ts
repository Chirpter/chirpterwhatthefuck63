
'use client';

/**
 * @fileoverview A client-side service to wrap the browser's SpeechSynthesis API.
 * This is not a hook and can be used in any client-side context.
 * It manages a single utterance at a time to prevent overlapping speech.
 */

let activeUtterance: SpeechSynthesisUtterance | null = null;
let voices: SpeechSynthesisVoice[] = [];

// Initialize and cache voices
function loadVoices() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
      };
    }
  }
}

// Load voices as soon as the module is loaded on the client.
if (typeof window !== 'undefined') {
  loadVoices();
}

export function getSystemVoices(): SpeechSynthesisVoice[] {
  if (voices.length === 0) {
    // A fallback in case onvoiceschanged hasn't fired yet.
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        voices = window.speechSynthesis.getVoices();
    }
  }
  return voices;
}

interface SpeakOptions {
  text: string;
  lang: string;
  voiceURI: string | null;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
  onBoundary?: (event: SpeechSynthesisEvent) => void;
  onError?: (event?: SpeechSynthesisErrorEvent) => void;
}

export function speak(options: SpeakOptions) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.error('Speech Synthesis not supported.');
    options.onError?.();
    return;
  }
  
  // Cancel any ongoing speech to prevent overlap. This now returns a promise.
  cancel().then(() => {
    // This code runs only after the previous utterance has been confirmed as cancelled.
    const utterance = new SpeechSynthesisUtterance(options.text);
    activeUtterance = utterance;

    utterance.lang = options.lang;
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;

    if (options.voiceURI) {
      const selectedVoice = getSystemVoices().find(v => v.voiceURI === options.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onend = () => {
      if (utterance === activeUtterance) {
          options.onEnd?.();
          activeUtterance = null;
      }
    };

    utterance.onboundary = (event) => {
      if (utterance === activeUtterance) {
          options.onBoundary?.(event);
      }
    };
    
    utterance.onerror = (event) => {
      if (utterance === activeUtterance) {
          console.error('TTS Service Error:', event.error);
          options.onError?.(event);
          activeUtterance = null;
      }
    };

    window.speechSynthesis.speak(utterance);
  });
}

export function cancel(): Promise<void> {
   return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            // Set a listener for the end of the current utterance, which also fires on cancel.
            const currentUtterance = activeUtterance;
            if (currentUtterance) {
                currentUtterance.onend = () => {
                    activeUtterance = null;
                    resolve();
                };
            }
        }
        activeUtterance = null; // Prevent any lingering callbacks from firing
        window.speechSynthesis.cancel();
        // If nothing was speaking, resolve immediately.
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            resolve();
        }
      } else {
        resolve(); // Resolve if speech synthesis is not available.
      }
   });
}


export function pause() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.pause();
  }
}

export function resume() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.resume();
  }
}

export function isSpeaking(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking;
}
