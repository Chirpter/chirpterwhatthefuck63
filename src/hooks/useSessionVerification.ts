
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

const VERIFY_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INITIAL_VERIFY_DELAY = 2000; // 2 seconds grace period

export function useSessionVerification() {
  const { authUser, isSessionReady, logout } = useAuth(); // Depend on isSessionReady
  const router = useRouter();
  const isVerifying = useRef(false);
  const initialCheckPerformed = useRef(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let initialTimeoutId: NodeJS.Timeout | null = null;

    const verifySession = async (isInitialCheck = false) => {
      if (isVerifying.current) {
        console.log('[Session] Verification skipped (already in progress).');
        return;
      }
      
      // This check is now robust because it runs after isSessionReady is true
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
          if (isInitialCheck && !intervalId) {
            intervalId = setInterval(() => verifySession(false), VERIFY_INTERVAL);
          }
        }
      } catch (error) {
        console.error('[Session] ❌ Verification API call failed:', error);
      } finally {
        isVerifying.current = false;
      }
    };

    // ✅ CRITICAL CHANGE: Only start the verification logic if the session is ready.
    if (authUser && isSessionReady && !initialCheckPerformed.current) {
      initialCheckPerformed.current = true;
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
  }, [authUser, isSessionReady, logout, router]); // Dependency array now includes isSessionReady
}
