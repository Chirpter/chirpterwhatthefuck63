"use client";

import React from 'react';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { AnimatePresence } from "framer-motion";
import { ExpandedPlayer } from './ExpandedPlayer';
import { CollapsedPlayer } from './CollapsedPlayer';

/**
 * Main AudioPlayer component that conditionally renders
 * either the expanded or collapsed player based on state
 */
export function AudioPlayer() {
  const { playerState, currentPlayingItem } = useAudioPlayer();
  
  // Don't render anything if there's no current item
  if (!currentPlayingItem) {
    return null;
  }
  
  return (
    <AnimatePresence mode="wait">
      {playerState === 'expanded' ? (
        <ExpandedPlayer key="expanded-player" />
      ) : (
        <CollapsedPlayer key="collapsed-player" />
      )}
    </AnimatePresence>
  );
}