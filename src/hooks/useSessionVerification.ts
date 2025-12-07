
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

const VERIFY_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INITIAL_VERIFY_DELAY = 2000; // 2 seconds grace period

export function useSessionVerification() {
  const { authUser, logout } = useAuth();
  const router = useRouter();
  const isVerifying = useRef(false);
  const initialCheckPerformed = useRef(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let initialTimeoutId: NodeJS.Timeout | null = null;

    const verifySession = async (isInitialCheck = false) => {
      // Prevent concurrent verification calls
      if (isVerifying.current) {
        console.log('[Session] Verification skipped (already in progress).');
        return;
      }
      
      if (!document.cookie.includes('__session')) {
          console.log('[Session] 🚪 No session cookie found. Logging out.');
          await logout();
          router.replace('/login');
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
          console.warn(`[Session] ⚠️ Verification failed, status: ${response.status}`);
          if (response.status === 401) {
            console.log('[Session] 🚪 Logging out due to invalid session...');
            await logout();
            router.replace('/login');
          }
        } else {
          console.log(`[Session] ✅ Session valid (Initial: ${isInitialCheck})`);
          // If the initial check is successful, start the regular checks
          if (isInitialCheck && !intervalId) {
            intervalId = setInterval(verifySession, VERIFY_INTERVAL);
          }
        }
      } catch (error) {
        console.error('[Session] ❌ Verification API call failed:', error);
      } finally {
        isVerifying.current = false;
      }
    };

    if (authUser && !initialCheckPerformed.current) {
      initialCheckPerformed.current = true;
      // Perform a single, delayed check after login to avoid race conditions.
      console.log(`[Session] Scheduling initial verification in ${INITIAL_VERIFY_DELAY}ms.`);
      initialTimeoutId = setTimeout(() => verifySession(true), INITIAL_VERIFY_DELAY);
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
  }, [authUser, logout, router]); // Dependency array is critical
}
