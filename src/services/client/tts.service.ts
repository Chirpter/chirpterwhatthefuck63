

'use client';

/**
 * @fileoverview A client-side service to wrap the browser's SpeechSynthesis API.
 * This is not a hook and can be used in any client-side context.
 * It manages a single utterance at a time to prevent overlapping speech.
 * Each call to `speak()` represents one "segment" of text.
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

/**
 * Speaks a given text using the browser's SpeechSynthesis API.
 * Each call to this function creates a single "utterance" (a single piece of speech).
 * It ensures that any currently speaking utterance is cancelled before starting a new one.
 * @param options - The configuration for the speech synthesis.
 */
export function speak(options: SpeakOptions) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.error('Speech Synthesis not supported.');
    options.onError?.();
    return;
  }
  
  // Cancel any ongoing speech to prevent overlap.
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
      // Only fire the onEnd callback if this is still the active utterance.
      // This prevents callbacks from cancelled utterances from firing.
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

/**
 * Cancels the currently speaking or pending utterance.
 * Returns a Promise that resolves when the cancellation is complete.
 * This is crucial because `speechSynthesis.cancel()` can be asynchronous.
 */
export function cancel(): Promise<void> {
   return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        // If something is actively speaking or queued
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            // The `onend` event of an utterance is reliably fired when it is cancelled.
            // We set a one-time listener on the utterance that is currently active.
            const currentUtterance = activeUtterance;
            if (currentUtterance) {
                currentUtterance.onend = () => {
                    activeUtterance = null; // Clean up reference
                    resolve(); // Signal that cancellation is complete
                };
            }
        }
        
        // Immediately nullify the active utterance reference to prevent any lingering
        // callbacks (like onBoundary) from firing after cancel() has been called.
        activeUtterance = null; 
        
        // Trigger the cancellation. The onend handler above will then resolve the promise.
        window.speechSynthesis.cancel();
        
        // If nothing was speaking in the first place, we can resolve immediately.
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            resolve();
        }
      } else {
        // If speech synthesis is not available, there's nothing to cancel.
        resolve(); 
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
