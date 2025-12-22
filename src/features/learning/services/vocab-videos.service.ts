// src/features/learning/services/vocab-videos.service.ts
'use server';

import { supabase } from '@/lib/supabase';
import type { FoundClip } from '@/lib/types';
import { ApiServiceError } from '@/lib/errors';

/**
 * Searches for video clips containing a specific term using a Supabase RPC.
 * @param term - The term to search for.
 * @param userId - The user's UID for rate limiting purposes.
 * @param limit - The maximum number of clips to return.
 * @returns A promise that resolves to an array of FoundClip objects.
 */
export async function searchClipsPaged(
  term: string,
  userId: string,
  limit: number = 10
): Promise<FoundClip[]> {
  if (!term) {
    return [];
  }

  const { data, error } = await supabase.rpc('search_clips_paged', {
    p_search_term: term,
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) {
    console.error('Error fetching clips from Supabase:', error);

    if (error.code === 'PGRST301' || error.message.includes('rate limit')) {
      throw new ApiServiceError(
        'You have reached your daily search limit.',
        'RATE_LIMIT'
      );
    }
    
    throw new ApiServiceError(
      'Failed to search for video clips.',
      'UNAVAILABLE',
      error
    );
  }

  // Ensure data is in the expected format
  return (data || []).map((item: any) => ({
    id: `${item.video_id}_${item.start_time}`,
    videoId: item.video_id,
    text: item.text,
    start: item.start_time,
    end: item.end_time,
    context: item.context || item.text, // Fallback for context
  }));
}
