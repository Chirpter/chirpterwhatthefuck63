
"use server";

import type { FoundClip } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { ApiServiceError } from '@/lib/errors';

// Supabase response type for type safety
interface SupabaseClipResponse {
  id: string;
  video_id: string;
  text: string;
  start_time: number;
  end_time: number;
  context: string | null;
}

/**
 * Search for video clips containing the search term
 * Rate limited on Supabase side (20 searches per day per user)
 */
export async function searchClipsPaged(
  searchTerm: string,
  userId: string,
  limit = 20,
  offset = 0
): Promise<FoundClip[]> {
  // Validate inputs
  if (!userId) {
    throw new ApiServiceError('Authentication required', 'AUTH');
  }

  if (!searchTerm.trim()) {
    return [];
  }

  try {
    const { data, error } = await supabase.rpc('search_video_sentences_paged', {
      search_query: searchTerm.trim(),
      limit_count: limit,
      offset_count: offset,
      user_id: userId
    });

    // Handle errors from Supabase
    if (error) {
        // This is the critical part: throw a standardized error.
        if (error.code === 'PGRST301' || error.message.includes('rate limit')) {
            throw new ApiServiceError(
                'Daily search limit reached. Please try again tomorrow.',
                'RATE_LIMIT'
            );
        }
        // For other database errors, wrap them.
        throw new Error(error.message);
    }

    // No results
    if (!data || data.length === 0) {
      return [];
    }

    // Normalize snake_case to camelCase with proper typing
    return (data as SupabaseClipResponse[]).map((clip) => ({
      id: clip.id,
      videoId: clip.video_id,
      text: clip.text,
      start: clip.start_time,
      end: clip.end_time,
      context: clip.context || '',
    }));
    
  } catch (error) {
    // Re-throw standardized ApiServiceError as-is
    if (error instanceof ApiServiceError) {
      throw error;
    }
    
    // Wrap any other unknown errors into a standard Error object before throwing.
    // This prevents non-Error objects from being thrown.
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during search.';
    throw new Error(errorMessage);
  }
}
