
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

const VERIFY_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useSessionVerification() {
  const { authUser, logout } = useAuth();
  const router = useRouter();
  const isVerifying = useRef(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const verifySession = async () => {
      // Prevent concurrent verification calls
      if (isVerifying.current || !document.hasFocus()) {
        console.log('[Session] Verification skipped (already running or window not focused).');
        return;
      }

      console.log(`[Session] 🔍 Verifying session...`);
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
      } finally {
        isVerifying.current = false;
      }
    };

    if (authUser) {
        // Start the recurring checks. The first check will be after VERIFY_INTERVAL.
        intervalId = setInterval(verifySession, VERIFY_INTERVAL);
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [authUser, logout, router]);
}
