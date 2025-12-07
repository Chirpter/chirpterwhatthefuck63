
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, usePathname } from 'next/navigation';

const VERIFY_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE = 2000;

export function useSessionVerification() {
  const { authUser, isSessionReady, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const isVerifying = useRef(false);
  const retryCount = useRef(0);
  const lastVerifyTime = useRef(0);
  const intervalId = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async (reason: string) => {
    try {
      await logout();
      // The logout function now handles redirection.
    } catch (error) {
      console.error('[Session] Logout failed:', error);
      // Force redirect as a fallback
      if (typeof window !== 'undefined') {
        window.location.replace(`/login?reason=${reason}`);
      }
    }
  }, [logout]);

  const verifySession = useCallback(async () => {
    if (isVerifying.current) {
      console.log('[Session] ⏭️  Verification skipped (already in progress)');
      return false;
    }
    
    const now = Date.now();
    if ((now - lastVerifyTime.current) < 30000) {
      console.log('[Session] ⏭️  Verification skipped (too soon)');
      return false;
    }
    
    isVerifying.current = true;
    lastVerifyTime.current = now;

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn(`[Session] ⚠️  Verification failed, status: ${response.status}`);
        const data = await response.json().catch(() => ({}));
        const reason = data.code === 'auth/session-cookie-expired' ? 'session_expired' : 'invalid_session';
        await handleLogout(reason);
        return false;
      }

      console.log('[Session] ✅ Session is valid.');
      retryCount.current = 0; // Reset retries on success
      return true;

    } catch (error) {
      console.error('[Session] ❌ Verification error:', error);
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        // We don't need to schedule a retry here; the interval will handle it.
      } else {
        console.error('[Session] ❌ Max retries reached for verification.');
        await handleLogout('verification_failed');
      }
      return false;
    } finally {
      isVerifying.current = false;
    }
  }, [handleLogout]);

  useEffect(() => {
    // Stop everything if user is not authenticated or session is not ready
    if (!authUser || !isSessionReady) {
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
      return;
    }
    
    // Do not start a new interval if one is already running
    if (intervalId.current) {
      return;
    }

    console.log(`[Session] ⏰ Starting periodic session check every ${VERIFY_INTERVAL / 60000} minutes.`);
    
    // Start periodic checks
    intervalId.current = setInterval(() => {
      verifySession();
    }, VERIFY_INTERVAL);
    
    // Cleanup on unmount or when auth state changes
    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
        console.log('[Session] 🛑 Stopped periodic session check.');
      }
    };
  }, [authUser, isSessionReady, verifySession]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && authUser && isSessionReady) {
        console.log('[Session] 👁️  Tab is visible, re-verifying session.');
        verifySession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authUser, isSessionReady, verifySession]);

}
