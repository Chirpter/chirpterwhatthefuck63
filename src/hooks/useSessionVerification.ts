// src/hooks/useSessionVerification.ts
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';

const VERIFY_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ✅ CRITICAL FIX: Increased grace period and smarter check logic
const INITIAL_GRACE_PERIOD = 3000; // 3 seconds grace period after mount

export function useSessionVerification() {
  const { authUser, logout } = useAuth();
  const lastVerifyRef = useRef<number>(0);
  const initialCheckTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup any existing timers when auth state changes or component unmounts
    if (initialCheckTimer.current) {
        clearTimeout(initialCheckTimer.current);
    }
    
    if (!authUser) {
      return;
    }

    const verifySession = async (isInitialCheck = false) => {
      const now = Date.now();
      
      // ✅ FIX: More robust check. Don't verify if it has been checked recently.
      if (!isInitialCheck && (now - lastVerifyRef.current < VERIFY_INTERVAL)) {
        return;
      }

      console.log(`[useSessionVerification] 🧐 Verifying session... (Initial: ${isInitialCheck})`);
      lastVerifyRef.current = now; // Mark as "attempted" to prevent spamming

      try {
        const response = await fetch('/api/auth/verify', { 
          method: 'POST',
          cache: 'no-store'
        });
        
        if (!response.ok) {
          console.warn('[useSessionVerification] ⚠️ Session verification failed, logging out...');
          await logout();
        } else {
           console.log('[useSessionVerification] ✅ Session verified successfully.');
        }
        
      } catch (error) {
        console.error('[useSessionVerification] ❌ Session verification request failed:', error);
      }
    };
    
    // ✅ FIX: Schedule the *first* verification after a grace period.
    // This is the key change to prevent the race condition after login.
    initialCheckTimer.current = setTimeout(() => {
        verifySession(true);
    }, INITIAL_GRACE_PERIOD);

    // Set up the recurring interval for subsequent checks
    const interval = setInterval(() => verifySession(false), VERIFY_INTERVAL);

    // Cleanup function
    return () => {
      if (initialCheckTimer.current) {
        clearTimeout(initialCheckTimer.current);
      }
      clearInterval(interval);
    };
  }, [authUser, logout]);
}
