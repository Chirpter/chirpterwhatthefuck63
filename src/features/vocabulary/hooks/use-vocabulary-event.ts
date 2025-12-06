
"use client";

import { useEffect } from 'react';
import { vocabularyEvents, type VocabularyEventType, type EventListener } from '../events/vocabulary-events';

/**
 * Hook to use vocabulary events in React components
 * Automatically handles cleanup on unmount
 */
export function useVocabularyEvent<T extends VocabularyEventType>(
  eventType: T,
  listener: EventListener<T>,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    const unsubscribe = vocabularyEvents.on(eventType, listener);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
