// src/hooks/useSessionVerification.ts
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';

// Verify session every 5 minutes
const VERIFY_INTERVAL = 5 * 60 * 1000;

/**
 * A client-side hook that periodically verifies the user's session
 * in the background. If the session becomes invalid, it triggers a logout.
 */
export function useSessionVerification() {
  const { authUser, logout } = useAuth();
  const lastVerifyRef = useRef<number>(0);

  useEffect(() => {
    // Only run if the user is authenticated on the client
    if (!authUser) return;

    const verifySession = async () => {
      const now = Date.now();
      
      // ✅ Only verify if it has been more than 5 minutes since the last check
      if (now - lastVerifyRef.current < VERIFY_INTERVAL) {
        return;
      }

      try {
        const response = await fetch('/api/auth/verify', { 
          method: 'POST',
          cache: 'no-store' // Never cache this request
        });
        
        // If the API returns a non-OK status (e.g., 401), the session is invalid.
        if (!response.ok) {
          console.warn('Session verification failed, logging out...');
          // Trigger the logout function from the auth context.
          await logout();
        }
        
        // Update the timestamp of the last verification
        lastVerifyRef.current = now;
      } catch (error) {
        console.error('Session verification request failed:', error);
        // In case of a network error, we might want to retry or handle it gracefully.
        // For now, we'll let the user continue, and the next check will try again.
      }
    };

    // Verify session immediately when the component mounts
    verifySession();

    // Set up a recurring interval to check the session
    const interval = setInterval(verifySession, VERIFY_INTERVAL);

    // Cleanup the interval when the component unmounts or the user changes
    return () => clearInterval(interval);
  }, [authUser, logout]);
}
