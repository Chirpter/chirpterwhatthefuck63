// Analytics helper for Firebase Analytics
// This file provides a clean interface for logging auth-related events

import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';
import { app } from '@/lib/firebase';

let analytics: ReturnType<typeof getAnalytics> | null = null;

// Initialize analytics only on client-side and if supported
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(err => {
    console.warn('Firebase Analytics not supported:', err);
  });
}

/**
 * Log authentication-related events to Firebase Analytics
 * Safe to call even if analytics is not initialized
 */
export const logAuthEvent = (
  eventName: string,
  eventParams?: Record<string, any>
) => {
  if (!analytics) return;

  try {
    logEvent(analytics, eventName, {
      timestamp: new Date().toISOString(),
      ...eventParams,
    });
  } catch (error) {
    // Fail silently in production, log in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Analytics event failed:', eventName, error);
    }
  }
};

/**
 * Common auth events you can track:
 * - 'sign_up' - User creates account
 * - 'login' - User logs in
 * - 'logout' - User logs out
 * - 'login_failed' - Login attempt failed
 * - 'auth_error' - General auth error
 * - 'rate_limit_hit' - User hit rate limit
 */