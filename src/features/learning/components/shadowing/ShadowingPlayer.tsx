
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

    // ✅ OPTIMIZED: Dùng timeout thay vì interval
    const scheduleSnippetEnd = useCallback(() => {
      // Clear timeout cũ nếu có
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!playerRef.current) return;

      try {
        const currentTime = playerRef.current.getCurrentTime();
        const remaining = currentSnippetRef.current.end - currentTime;

        // Nếu còn thời gian, schedule pause
        if (remaining > 0) {
          timeoutRef.current = setTimeout(() => {
            if (playerRef.current) {
              playerRef.current.pauseVideo();
              onVideoEnd();
            }
          }, remaining * 1000);
        }
      } catch (error) {
        console.error('Schedule error:', error);
      }
    }, [onVideoEnd]);

    const stopSchedule = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        stopSchedule();
        playerRef.current = null;
      };
    }, [stopSchedule]);

    useImperativeHandle(ref, () => ({
      play: () => {
        if (playerRef.current) {
          playerRef.current.playVideo();
          scheduleSnippetEnd();
        }
      },
      pause: () => {
        if (playerRef.current) {
          playerRef.current.pauseVideo();
          stopSchedule();
        }
      },
      seekToAndPlay: (seconds: number) => {
        if (playerRef.current) {
          playerRef.current.seekTo(seconds, true);
          playerRef.current.playVideo();
        }
      },
      loadSnippet: (start: number, end: number) => {
        if (playerRef.current) {
          currentSnippetRef.current = { start, end };
          playerRef.current.seekTo(start, true);
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
        scheduleSnippetEnd(); // ✅ Schedule end khi bắt đầu play
      } else if (event.data === 2) { // Paused
        onVideoPause?.();
        stopSchedule(); // ✅ Clear schedule khi pause
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
        origin: process.env.NEXT_PUBLIC_APP_URL, // ✅ FIX: Specify origin
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
