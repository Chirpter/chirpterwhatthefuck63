
// src/features/vocabulary/events/vocabulary-events.ts
// ============================================================================
// EVENT BUS FOR VOCABULARY FEATURE
// Decouples vocabulary operations from side effects (achievements, analytics, etc.)
// ============================================================================

import type { VocabularyItem } from '@/lib/types';

/**
 * Vocabulary event types
 * Emitted when vocabulary operations occur
 */
export enum VocabularyEventType {
  ITEM_ADDED = 'vocabulary:item:added',
  ITEM_UPDATED = 'vocabulary:item:updated',
  ITEM_DELETED = 'vocabulary:item:deleted',
  FOLDER_CREATED = 'vocabulary:folder:created',
  FOLDER_RENAMED = 'vocabulary:folder:renamed',
  BATCH_IMPORTED = 'vocabulary:batch:imported',
}

/**
 * Event payload types for type-safe event handling
 */
export interface VocabularyEventPayloads {
  [VocabularyEventType.ITEM_ADDED]: {
    userId: string;
    item: VocabularyItem;
    source: 'manual' | 'import' | 'reading' | 'video';
  };
  
  [VocabularyEventType.ITEM_UPDATED]: {
    userId: string;
    itemId: string;
    updates: Partial<VocabularyItem>;
    previousState?: Partial<VocabularyItem>;
  };
  
  [VocabularyEventType.ITEM_DELETED]: {
    userId: string;
    itemId: string;
    deletedItem: VocabularyItem;
  };
  
  [VocabularyEventType.FOLDER_CREATED]: {
    userId: string;
    folderName: string;
  };
  
  [VocabularyEventType.FOLDER_RENAMED]: {
    userId: string;
    oldName: string;
    newName: string;
    affectedItemCount: number;
  };
  
  [VocabularyEventType.BATCH_IMPORTED]: {
    userId: string;
    itemCount: number;
    source: string;
  };
}

/**
 * Event listener callback type
 */
export type EventListener<T extends VocabularyEventType> = (
  payload: VocabularyEventPayloads[T]
) => void | Promise<void>;

/**
 * Simple event bus implementation for vocabulary events
 * Can be replaced with a more sophisticated solution (e.g., mitt, eventemitter3) if needed
 */
class VocabularyEventBus {
  private listeners: Map<VocabularyEventType, Set<EventListener<any>>> = new Map();

  /**
   * Subscribe to a vocabulary event
   * Returns an unsubscribe function
   */
  on<T extends VocabularyEventType>(
    eventType: T,
    listener: EventListener<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Subscribe to an event only once
   * Automatically unsubscribes after first execution
   */
  once<T extends VocabularyEventType>(
    eventType: T,
    listener: EventListener<T>
  ): void {
    const wrappedListener: EventListener<T> = async (payload) => {
      await listener(payload);
      this.listeners.get(eventType)?.delete(wrappedListener);
    };
    
    this.on(eventType, wrappedListener);
  }

  /**
   * Emit a vocabulary event
   * All registered listeners will be called asynchronously
   */
  async emit<T extends VocabularyEventType>(
    eventType: T,
    payload: VocabularyEventPayloads[T]
  ): Promise<void> {
    const listeners = this.listeners.get(eventType);
    
    if (!listeners || listeners.size === 0) {
      return;
    }

    // Execute all listeners
    // Using Promise.allSettled to ensure one failing listener doesn't break others
    const results = await Promise.allSettled(
      Array.from(listeners).map(listener => listener(payload))
    );

    // Log any errors (optional: could send to error tracking service)
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `[VocabularyEventBus] Listener ${index} for event ${eventType} failed:`,
          result.reason
        );
      }
    });
  }

  /**
   * Remove all listeners for a specific event type
   */
  off(eventType: VocabularyEventType): void {
    this.listeners.delete(eventType);
  }

  /**
   * Remove all listeners for all events
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners for an event (useful for debugging)
   */
  listenerCount(eventType: VocabularyEventType): number {
    return this.listeners.get(eventType)?.size || 0;
  }
}

/**
 * Singleton event bus instance
 * Export this to use across the application
 */
export const vocabularyEvents = new VocabularyEventBus();
