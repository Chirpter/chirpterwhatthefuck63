
// src/features/vocabulary/index.ts
// ============================================================================
// PUBLIC API FOR THE VOCABULARY FEATURE
// This file serves as the main entry point for the vocabulary module.
// It initializes all necessary listeners and side effects.
// Call this once during app startup.
// ============================================================================

import { initializeAchievementListener, cleanupAchievementListener } from '@/features/vocabulary/listeners/achievement-listener';

let isInitialized = false;

/**
 * Initializes all vocabulary-related features and listeners.
 * This function is idempotent and can be safely called multiple times.
 */
export function initializeVocabularyFeature(): void {
  if (isInitialized) {
    return;
  }
  
  // Initialize all listeners related to this feature
  initializeAchievementListener();

  // TODO: Add other listeners here as they are created:
  // - initializeAnalyticsListener();
  // - initializeSyncListener();

  isInitialized = true;
  console.log('[VocabularyFeature] Initialized successfully');
}

/**
 * Cleanup function for the vocabulary feature.
 * This should be called when the user logs out or the app is shutting down.
 */
export function cleanupVocabularyFeature(): void {
  if (!isInitialized) {
    return;
  }
  
  // Cleanup all listeners to prevent memory leaks
  cleanupAchievementListener();
  
  isInitialized = false;
  console.log('[VocabularyFeature] Cleaned up successfully');
}
