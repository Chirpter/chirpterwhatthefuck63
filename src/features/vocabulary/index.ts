
// src/features/vocabulary/index.ts
// ============================================================================
// PUBLIC API FOR THE VOCABULARY FEATURE
// This file serves as the main entry point for the vocabulary module.
// It is no longer responsible for initializing listeners to avoid module boundary errors.
// ============================================================================

// ✅ FIX: Removed imports that were causing server-side modules to leak into the client.
// The initialization logic is now handled directly in `ClientProviders.tsx`.

let isInitialized = false;

/**
 * This function is deprecated. Initialization is now handled in ClientProviders.
 * @deprecated
 */
export function initializeVocabularyFeature(): void {
  if (isInitialized) {
    return;
  }
  
  isInitialized = true;
  console.log('[VocabularyFeature] Feature loaded. Initialization occurs in ClientProviders.');
}

/**
 * This function is deprecated. Cleanup is now handled in ClientProviders.
 * @deprecated
 */
export function cleanupVocabularyFeature(): void {
  if (!isInitialized) {
    return;
  }
  
  isInitialized = false;
  console.log('[VocabularyFeature] Feature cleanup handled by ClientProviders.');
}
