// src/hooks/useSessionVerification.ts
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';

// Verify session every 5 minutes
const VERIFY_INTERVAL = 5 * 60 * 1000;

// ✅ CRITICAL: Initial grace period to allow session cookie to be set
const INITIAL_GRACE_PERIOD = 3000; // 3 seconds

/**
 * A client-side hook that periodically verifies the user's session
 * in the background. If the session becomes invalid, it triggers a logout.
 */
export function useSessionVerification() {
  const { authUser, logout } = useAuth();
  const lastVerifyRef = useRef<number>(0);
  const mountTimeRef = useRef<number>(Date.now());
  const hasRunInitialCheck = useRef(false);

  useEffect(() => {
    // Only run if the user is authenticated on the client
    if (!authUser) {
      hasRunInitialCheck.current = false;
      return;
    }

    const verifySession = async () => {
      const now = Date.now();
      
      // ✅ FIX 1: Skip initial check if we just mounted (give time for cookie to be set)
      if (!hasRunInitialCheck.current) {
        const timeSinceMount = now - mountTimeRef.current;
        if (timeSinceMount < INITIAL_GRACE_PERIOD) {
          console.log('⏳ Skipping initial session check - waiting for cookie setup');
          hasRunInitialCheck.current = true;
          lastVerifyRef.current = now;
          return;
        }
        hasRunInitialCheck.current = true;
      }
      
      // ✅ FIX 2: Only verify if it has been more than 5 minutes since the last check
      if (now - lastVerifyRef.current < VERIFY_INTERVAL) {
        return;
      }

      try {
        const response = await fetch('/api/auth/verify', { 
          method: 'POST',
          cache: 'no-store'
        });
        
        if (!response.ok) {
          console.warn('⚠️ Session verification failed, logging out...');
          await logout();
        } else {
          console.log('✅ Session verified successfully');
        }
        
        lastVerifyRef.current = now;
      } catch (error) {
        console.error('❌ Session verification request failed:', error);
        // Don't logout on network errors - might be temporary
      }
    };

    // ✅ FIX 3: Don't verify immediately - wait for initial grace period
    const initialTimeout = setTimeout(() => {
      verifySession();
    }, INITIAL_GRACE_PERIOD);

    // Set up a recurring interval to check the session
    const interval = setInterval(verifySession, VERIFY_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [authUser, logout]);
}