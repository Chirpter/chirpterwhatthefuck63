'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

const VERIFY_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INITIAL_GRACE_PERIOD = 5000; // 5 seconds - enough time for session creation

export function useSessionVerification() {
  const { authUser, logout } = useAuth();
  const router = useRouter();
  const lastVerifyRef = useRef<number>(0);
  const hasRunInitialCheck = useRef(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!authUser) {
      hasRunInitialCheck.current = false;
      return;
    }

    const verifySession = async (isInitialCheck = false) => {
      const now = Date.now();
      
      // Prevent duplicate checks
      if (!isInitialCheck && (now - lastVerifyRef.current < VERIFY_INTERVAL - 1000)) {
        return;
      }

      // Prevent verification spam
      if (isVerifying) {
        console.log('[Session] Already verifying, skipping...');
        return;
      }

      console.log(`[Session] 🔍 Verifying session... (Initial: ${isInitialCheck})`);
      setIsVerifying(true);
      lastVerifyRef.current = now;

      try {
        const response = await fetch('/api/auth/verify', { 
          method: 'POST',
          cache: 'no-store',
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.warn('[Session] ⚠️ Verification failed, status:', response.status);
          
          // Only logout if it's not the initial check or if session is truly invalid
          if (!isInitialCheck || response.status === 401) {
            console.log('[Session] 🚪 Logging out due to invalid session...');
            await logout();
            router.replace('/login');
          }
        } else {
          console.log('[Session] ✅ Session valid');
        }
        
      } catch (error) {
        console.error('[Session] ❌ Verification error:', error);
        // Don't logout on network errors during initial check
        if (!isInitialCheck) {
          await logout();
          router.replace('/login');
        }
      } finally {
        setIsVerifying(false);
      }
    };
    
    // Initial check with grace period (only once per auth session)
    if (!hasRunInitialCheck.current) {
      hasRunInitialCheck.current = true;
      
      const initialTimer = setTimeout(() => {
        verifySession(true);
      }, INITIAL_GRACE_PERIOD);

      // Set up recurring checks
      const interval = setInterval(() => {
        verifySession(false);
      }, VERIFY_INTERVAL);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(interval);
      };
    } else {
      // If already checked, just set up the interval
      const interval = setInterval(() => {
        verifySession(false);
      }, VERIFY_INTERVAL);

      return () => clearInterval(interval);
    }
  }, [authUser, logout, router, isVerifying]);
}