// src/features/learning/components/shadowing/ShadowingPlayer.tsx
"use client";

import React, {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import YouTube from "react-youtube";
import type { YouTubePlayer } from "react-youtube";

export interface ShadowingPlayerHandle {
  play: () => void;
  pause: () => void;
  seekToAndPlay: (seconds: number) => void;
  loadSnippet: (start: number, end: number) => void;
}

interface ShadowingPlayerProps {
  videoId: string;
  onPlayerReady?: () => void;
  onVideoEnd: () => void;
  onVideoPlay?: () => void;
  onVideoPause?: () => void;
}

export const ShadowingPlayer = forwardRef<
  ShadowingPlayerHandle,
  ShadowingPlayerProps
>(
  (
    {
      videoId,
      onPlayerReady,
      onVideoEnd,
      onVideoPlay,
      onVideoPause,
    },
    ref
  ) => {
    const playerRef = useRef<YouTubePlayer | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentSnippetRef = useRef({ start: 0, end: 0 });

    // ✅ FIXED: Error handling for getCurrentTime
    const scheduleSnippetEnd = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!playerRef.current) return;

      try {
        const currentTime = playerRef.current.getCurrentTime();
        const remaining = currentSnippetRef.current.end - currentTime;

        if (remaining > 0.1) { // Small buffer
          timeoutRef.current = setTimeout(() => {
            if (playerRef.current) {
              try {
                playerRef.current.pauseVideo();
              } catch (e) {
                console.warn('Pause failed:', e);
              }
              onVideoEnd();
            }
          }, remaining * 1000);
        }
      } catch (error) {
        console.warn('getCurrentTime failed:', error);
        // Fallback: just call onVideoEnd
        onVideoEnd();
      }
    }, [onVideoEnd]);

    const stopSchedule = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }, []);

    useEffect(() => {
      return () => {
        stopSchedule();
        playerRef.current = null;
      };
    }, [stopSchedule]);

    useImperativeHandle(ref, () => ({
      play: () => {
        if (playerRef.current) {
          try {
            playerRef.current.playVideo();
            scheduleSnippetEnd();
          } catch (e) {
            console.error('Play failed:', e);
          }
        }
      },
      pause: () => {
        if (playerRef.current) {
          try {
            playerRef.current.pauseVideo();
            stopSchedule();
          } catch (e) {
            console.error('Pause failed:', e);
          }
        }
      },
      seekToAndPlay: (seconds: number) => {
        if (playerRef.current) {
          try {
            playerRef.current.seekTo(seconds, true);
            playerRef.current.playVideo();
          } catch (e) {
            console.error('Seek failed:', e);
          }
        }
      },
      loadSnippet: (start: number, end: number) => {
        if (playerRef.current) {
          try {
            currentSnippetRef.current = { start, end };
            playerRef.current.seekTo(start, true);
          } catch (e) {
            console.error('Load snippet failed:', e);
          }
        }
      },
    }), [scheduleSnippetEnd, stopSchedule]);

    const handlePlayerReady = useCallback(
      (event: { target: YouTubePlayer }) => {
        playerRef.current = event.target;
        onPlayerReady?.();
      },
      [onPlayerReady]
    );

    const onPlayerStateChange = useCallback((event: { data: number }) => {
      if (event.data === 1) { // Playing
        onVideoPlay?.();
        scheduleSnippetEnd();
      } else if (event.data === 2) { // Paused
        onVideoPause?.();
        stopSchedule();
      }
    }, [onVideoPlay, onVideoPause, scheduleSnippetEnd, stopSchedule]);
    
    const opts = {
      height: "100%",
      width: "100%",
      playerVars: {
        controls: 1,
        rel: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    };

    return (
      <div className="aspect-video w-full bg-black rounded-xl overflow-hidden">
        <YouTube
          key={videoId}
          videoId={videoId}
          opts={opts}
          onReady={handlePlayerReady}
          onStateChange={onPlayerStateChange}
          className="w-full h-full"
        />
      </div>
    );
  }
);

ShadowingPlayer.displayName = "ShadowingPlayer";