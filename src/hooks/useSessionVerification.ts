
'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

const VERIFY_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INITIAL_GRACE_PERIOD = 3000; // 3 seconds grace period after authUser is available

export function useSessionVerification() {
  const { authUser, logout } = useAuth();
  const router = useRouter();
  const hasRunInitialCheck = useRef(false);
  const isVerifying = useRef(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let initialTimeoutId: NodeJS.Timeout | null = null;

    const verifySession = async (isInitialCheck = false) => {
      // Prevent concurrent verification calls
      if (isVerifying.current) {
        console.log('[Session] Verification already in progress, skipping.');
        return;
      }

      console.log(`[Session] 🔍 Verifying session... (Initial: ${isInitialCheck})`);
      isVerifying.current = true;

      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'include',
        });

        if (!response.ok) {
          console.warn('[Session] ⚠️ Verification failed, status:', response.status);
          if (response.status === 401) {
            console.log('[Session] 🚪 Logging out due to invalid session...');
            await logout();
            router.replace('/login');
          }
        } else {
          console.log('[Session] ✅ Session valid');
        }
      } catch (error) {
        console.error('[Session] ❌ Verification API call failed:', error);
        // Avoid logging out on network errors for a better user experience,
        // especially on the initial check. The next interval will try again.
      } finally {
        isVerifying.current = false;
      }
    };

    if (authUser) {
      if (!hasRunInitialCheck.current) {
        // Perform the first check after a grace period to allow session propagation
        initialTimeoutId = setTimeout(() => {
          verifySession(true);
          hasRunInitialCheck.current = true;

          // Start the recurring checks only after the first one is done
          intervalId = setInterval(() => {
            verifySession(false);
          }, VERIFY_INTERVAL);
        }, INITIAL_GRACE_PERIOD);

      } else {
        // If the initial check has already run, just start the interval
        intervalId = setInterval(() => {
          verifySession(false);
        }, VERIFY_INTERVAL);
      }
    } else {
      // If user logs out, reset the initial check flag
      hasRunInitialCheck.current = false;
    }

    // Cleanup function
    return () => {
      if (initialTimeoutId) {
        clearTimeout(initialTimeoutId);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [authUser, logout, router]);
}
