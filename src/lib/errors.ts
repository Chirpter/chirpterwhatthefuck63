// src/lib/errors.ts

/**
 * @fileoverview Centralized place for custom error types used across the application.
 */

/**
 * A custom error class for handling API service errors, such as those from Supabase or Cloudflare Workers.
 * This ensures that errors thrown from server actions are standardized.
 */
export class ApiServiceError extends Error {
  constructor(
    public message: string,
    public code: 'RATE_LIMIT' | 'AUTH' | 'NETWORK' | 'UNKNOWN' | 'FIRESTORE' | 'PERMISSION' | 'UNAVAILABLE' | 'VALIDATION' = 'UNKNOWN',
    public originalError?: any
  ) {
    super(message);
    this.name = 'ApiServiceError';
  }
}
