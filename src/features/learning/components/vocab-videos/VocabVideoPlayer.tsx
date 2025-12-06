"use client";

import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from "react-youtube";
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import type { FoundClip } from '@/lib/types';

export interface VocabVideoPlayerHandle {
  loadAndPlay: (clip: FoundClip) => void;
  replay: () => void; // ← ADDED: Replay current clip
}

interface VocabVideoPlayerProps {
  onVideoEnd: () => void;
  onVideoPlay?: () => void;
  onVideoPause?: () => void;
}

export const VocabVideoPlayer = forwardRef<VocabVideoPlayerHandle, VocabVideoPlayerProps>(({
  onVideoEnd,
  onVideoPlay,
  onVideoPause
}, ref) => {
  const [activeClip, setActiveClip] = useState<FoundClip | null>(null);
  const [loadState, setLoadState] = useState({
    isInitializing: false,
    hasError: false,
    errorMessage: ''
  });
  const [isTransitioning, setIsTransitioning] = useState(false); // ← ADDED: Track clip transitions
  
  const playerRef = useRef<YouTubePlayer | null>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout>();
  
  // UPDATED: Expose loadAndPlay + replay methods
  useImperativeHandle(ref, () => ({
    loadAndPlay: (clip: FoundClip) => {
      setLoadState({ isInitializing: true, hasError: false, errorMessage: '' });
      setIsTransitioning(true); // ← ADDED: Start transition
      setActiveClip(clip);
      
      // Clear existing timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      
      // ADDED: Safety timeout - prevent stuck loading
      loadTimeoutRef.current = setTimeout(() => {
        setLoadState({
          isInitializing: false,
          hasError: true,
          errorMessage: 'Video failed to load. Please try again.'
        });
        setIsTransitioning(false); // ← ADDED: End transition on timeout
      }, 15000); // 15 second timeout
    },
    
    // ADDED: Replay current clip from start
    replay: () => {
      if (playerRef.current && activeClip) {
        playerRef.current.seekTo(activeClip.start, true);
        playerRef.current.playVideo();
      }
    }
  }), [activeClip]);

  // Player ready callback
  const onPlayerReady = useCallback((event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    
    // ADDED: Clear timeout on successful load
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    
    setLoadState({ isInitializing: false, hasError: false, errorMessage: '' });
    
    // ADDED: End transition when player is ready
    setTimeout(() => {
      setIsTransitioning(false);
    }, 100); // Small delay to ensure smooth visual transition
  }, []);

  // State changes
  const onStateChange = useCallback((event: { data: number }) => {
    const state = event.data;
    
    if (state === 1) {
      // Playing
      setLoadState(prev => ({ ...prev, isInitializing: false }));
      onVideoPlay?.();
    } else if (state === 2) {
      // Paused
      onVideoPause?.();
    } else if (state === 0) {
      // Ended - YouTube stopped at 'end' parameter automatically
      onVideoEnd();
    }
  }, [onVideoPlay, onVideoPause, onVideoEnd]);
  
  // ADDED: Error handler
  const onError = useCallback((error: any) => {
    console.error('YouTube player error:', error);
    
    // Clear timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    
    setLoadState({
      isInitializing: false,
      hasError: true,
      errorMessage: 'This video is unavailable'
    });
    setIsTransitioning(false); // ← ADDED: End transition on error
  }, []);
  
  // ADDED: Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  // No clip selected
  if (!activeClip) {
    return (
      <div className="aspect-video w-full rounded-xl bg-muted/30 border-2 border-dashed flex flex-col items-center justify-center p-4 text-center">
        <Icon name="Youtube" className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="font-semibold text-foreground">Search a word to see clips</p>
        <p className="text-sm text-muted-foreground">Learn vocabulary in real-world context.</p>
      </div>
    );
  }
  
  // ADDED: Error state with retry button
  if (loadState.hasError) {
    return (
      <div className="aspect-video w-full rounded-xl bg-destructive/10 border-2 border-destructive/50 flex flex-col items-center justify-center p-4 text-center">
        <Icon name="AlertCircle" className="h-12 w-12 text-destructive mb-3" />
        <p className="font-semibold text-destructive mb-1">{loadState.errorMessage}</p>
        <p className="text-xs text-muted-foreground mb-4">Video ID: {activeClip.videoId}</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            // Retry loading
            setLoadState({ isInitializing: true, hasError: false, errorMessage: '' });
            setActiveClip({ ...activeClip }); // Force re-render
          }}
        >
          <Icon name="RefreshCw" className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // YouTube player options with start/end times
  const opts = {
    height: "100%",
    width: "100%",
    playerVars: {
      autoplay: 1,
      start: Math.floor(activeClip.start),
      end: Math.floor(activeClip.end),
      controls: 1,
      rel: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      playsinline: 1,
    },
  };

  return (
    <div className="aspect-video w-full bg-black rounded-xl overflow-hidden relative">
      {loadState.isInitializing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <Icon name="Loader2" className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
      {/* ADDED: Transition indicator - subtle loading feedback between clips */}
      {isTransitioning && !loadState.isInitializing && !loadState.hasError && (
        <div className="absolute bottom-4 right-4 z-20 bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
          <div className="flex items-center gap-2">
            <Icon name="Loader2" className="animate-spin h-3 w-3 text-white" />
            <span className="text-xs text-white font-medium">Loading clip...</span>
          </div>
        </div>
      )}
      <YouTube
        key={`${activeClip.videoId}-${activeClip.start}-${activeClip.end}`}
        videoId={activeClip.videoId}
        opts={opts}
        onReady={onPlayerReady}
        onStateChange={onStateChange}
        onError={onError}
        className="w-full h-full"
      />
    </div>
  );
});

VocabVideoPlayer.displayName = 'VocabVideoPlayer';