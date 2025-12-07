
"use client";

import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from "react-youtube";
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import type { FoundClip } from '@/lib/types';

export interface VocabVideoPlayerHandle {
  loadAndPlay: (clip: FoundClip) => void;
  replay: () => void;
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
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const playerRef = useRef<YouTubePlayer | null>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout>();
  
  useImperativeHandle(ref, () => ({
    loadAndPlay: (clip: FoundClip) => {
      setLoadState({ isInitializing: true, hasError: false, errorMessage: '' });
      setIsTransitioning(true);
      setActiveClip(clip);
      
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      
      loadTimeoutRef.current = setTimeout(() => {
        setLoadState({
          isInitializing: false,
          hasError: true,
          errorMessage: 'Video failed to load. Please try again.'
        });
        setIsTransitioning(false);
      }, 15000);
    },
    
    replay: () => {
      if (playerRef.current && activeClip) {
        playerRef.current.seekTo(activeClip.start, true);
        playerRef.current.playVideo();
      }
    }
  }), [activeClip]);

  const onPlayerReady = useCallback((event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    
    setLoadState({ isInitializing: false, hasError: false, errorMessage: '' });
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, 100);
  }, []);

  const onStateChange = useCallback((event: { data: number }) => {
    const state = event.data;
    
    if (state === 1) { // Playing
      setLoadState(prev => ({ ...prev, isInitializing: false }));
      onVideoPlay?.();
    } else if (state === 2) { // Paused
      onVideoPause?.();
    } else if (state === 0) { // Ended
      onVideoEnd();
    }
  }, [onVideoPlay, onVideoPause, onVideoEnd]);
  
  const onError = useCallback((error: any) => {
    console.error('YouTube player error:', error);
    
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    
    setLoadState({
      isInitializing: false,
      hasError: true,
      errorMessage: 'This video is unavailable'
    });
    setIsTransitioning(false);
  }, []);
  
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  if (!activeClip) {
    return (
      <div className="aspect-video w-full rounded-xl bg-muted/30 border-2 border-dashed flex flex-col items-center justify-center p-4 text-center">
        <Icon name="Youtube" className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="font-semibold text-foreground">Search a word to see clips</p>
        <p className="text-sm text-muted-foreground">Learn vocabulary in real-world context.</p>
      </div>
    );
  }
  
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
            setLoadState({ isInitializing: true, hasError: false, errorMessage: '' });
            setActiveClip({ ...activeClip });
          }}
        >
          <Icon name="RefreshCw" className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

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
