// src/features/vocabulary/listeners/achievement-listener.ts
// ============================================================================
// ACHIEVEMENT LISTENER FOR VOCABULARY EVENTS
// Decouples achievement logic from vocabulary service
// This listener responds to vocabulary events and triggers achievement checks
// ============================================================================

import { checkAndUnlockAchievements } from '@/services/server/achievement-service';
import { vocabularyEvents, VocabularyEventType } from '../events/vocabulary-events';

let unsubscribeItemAdded: (() => void) | null = null;
let unsubscribeBatchImported: (() => void) | null = null;

/**
 * Initializes achievement-related event listeners
 * Call this once during app initialization
 */
export function initializeAchievementListener(): void {
  // Unsubscribe from previous listeners to prevent duplicates on HMR
  if (unsubscribeItemAdded) unsubscribeItemAdded();
  if (unsubscribeBatchImported) unsubscribeBatchImported();

  // Listen for vocabulary item added events
  unsubscribeItemAdded = vocabularyEvents.on(
    VocabularyEventType.ITEM_ADDED,
    async ({ userId }) => {
      try {
        await checkAndUnlockAchievements(userId);
      } catch (error) {
        console.error('[AchievementListener] Failed to check achievements after item added:', error);
        // Don't throw - we don't want to break the vocabulary add flow
      }
    }
  );

  // Listen for batch imports
  unsubscribeBatchImported = vocabularyEvents.on(
    VocabularyEventType.BATCH_IMPORTED,
    async ({ userId, itemCount }) => {
      try {
        // Only check achievements if significant batch (>5 items)
        if (itemCount >= 5) {
          await checkAndUnlockAchievements(userId);
        }
      } catch (error) {
        console.error('[AchievementListener] Failed to check achievements after batch import:', error);
      }
    }
  );

  console.log('[AchievementListener] Initialized');
}

/**
 * Cleanup function to remove all listeners
 * Call this during app shutdown or when switching users
 */
export function cleanupAchievementListener(): void {
  if (unsubscribeItemAdded) {
    unsubscribeItemAdded();
    unsubscribeItemAdded = null;
  }
  if (unsubscribeBatchImported) {
    unsubscribeBatchImported();
    unsubscribeBatchImported = null;
  }
  
  console.log('[AchievementListener] Cleaned up');
}
