
"use client";

import React, { createContext, useContext } from 'react';
import { useVocabVideos } from '../hooks/useVocabVideos';

// --- Type Definition ---
// The state shape is determined by the return type of the useVocabVideos hook.
type VocabVideosState = ReturnType<typeof useVocabVideos>;

// --- Context Creation ---
// Create a React Context to hold the state and functions for the VocabVideos feature.
// This allows child components to access the feature's logic without prop drilling.
const VocabVideosContext = createContext<VocabVideosState | undefined>(undefined);


// --- Provider Component ---
/**
 * The VocabVideosProvider is a wrapper component that:
 * 1. Executes the useVocabVideos hook to get all the state and logic for the feature.
 * 2. Provides this state and logic to all child components via the VocabVideosContext.
 * Any component that needs to interact with the Vocab in Videos feature should be a descendant of this provider.
 */
export const VocabVideosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const vocabVideosState = useVocabVideos();

  return (
    <VocabVideosContext.Provider value={vocabVideosState}>
      {children}
    </VocabVideosContext.Provider>
  );
};


// --- Custom Hook for Consumption ---
/**
 * A custom hook that provides an easy and type-safe way for components
 * to access the state and functions of the Vocab in Videos feature.
 * It ensures that the component using it is wrapped within a VocabVideosProvider.
 */
export const useVocabVideosContext = () => {
    const context = useContext(VocabVideosContext);
    if (context === undefined) {
        throw new Error('useVocabVideosContext must be used within a VocabVideosProvider');
    }
    return context;
};
