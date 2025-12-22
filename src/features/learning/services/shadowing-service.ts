// src/features/learning/services/shadowing-service.ts
'use server';

import type { FoundClip } from '@/lib/types';
import { ApiServiceError } from '@/lib/errors';

export interface TranscriptResult {
    transcript: FoundClip[];
    title: string;
    channel: string;
    thumbnail: string;
}

function getVideoIdFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
  } catch (e) {
    if (url.length === 11 && !url.includes(' ')) {
      return url;
    }
    return null;
  }
  return null;
}

/**
 * Fetches a transcript and NORMALIZES it to the FoundClip format.
 * @param videoUrl - The URL of the YouTube video.
 * @param userId - The Firebase UID of the user, passed from the client.
 * @returns A promise that resolves to an object containing the transcript and video metadata.
 */
export async function getTranscriptFromUrl(videoUrl: string, userId: string): Promise<TranscriptResult> {
  if (!videoUrl) {
    throw new Error("Video URL is required.");
  }
  
  if (!userId) {
      throw new ApiServiceError("You must be logged in to use this feature.", "AUTH");
  }

  const videoId = getVideoIdFromUrl(videoUrl);

  if (!videoId) {
    throw new Error("Invalid YouTube URL. Please provide a valid video link or ID.");
  }

  try {
    const response = await fetch('https://worker-transcript-fetcher.chirpter.workers.dev/transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        videoId: videoId,
        userId: userId,
        lang: 'en'
      }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Request failed with status ${response.status}` }));
        
        if (typeof errorData.error === 'string' && errorData.error.includes('limit')) {
            throw new ApiServiceError(errorData.error, 'RATE_LIMIT');
        }
        throw new ApiServiceError(errorData.error || `Could not connect to the transcript service. Status: ${response.status}`, 'UNAVAILABLE');
    }

    const data = await response.json();

    if (!data.success) {
        throw new ApiServiceError(data.error || 'Could not get transcript for this video. It might be private or have transcripts disabled.', 'UNAVAILABLE');
    }
    
    // --- NORMALIZATION STEP ---
    const transcript = (data.transcript || []).map((segment: any, index: number) => {
        const start = segment.start || 0;
        const end = segment.end || 0;
        
        return {
            id: `${videoId}-${index}`,
            videoId: videoId,
            text: segment.text,
            start: start,    
            end: end,       
            context: ''
        };
    });
    
    return {
        transcript: transcript,
        title: data.metadata?.title || 'Untitled Video',
        channel: data.metadata?.channel || 'Unknown Channel',
        thumbnail: data.metadata?.thumbnail || '',
    };
    
  } catch (error) {
    // Re-throw standardized ApiServiceError as-is
    if (error instanceof ApiServiceError) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : "Could not connect to the transcript service. Please check your internet connection.";
    throw new ApiServiceError(errorMessage, 'NETWORK');
  }
}
