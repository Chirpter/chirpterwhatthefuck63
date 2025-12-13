// src/providers/auth-provider.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { AuthContext, type AuthContextType } from '@/contexts/auth-context';
import { ApiServiceError } from '@/lib/errors';
import { useTranslation } from 'react-i18next';


// --- Helper Functions ---

const perfLog = (label: string, startTime: number) => {
  const duration = performance.now() - startTime;
  const color = duration < 100 ? '🟢' : duration < 300 ? '🟡' : '🔴';
  console.log(`${color} [PERF] ${label}: ${duration.toFixed(2)}ms`);
  return duration;
};

async function setSessionCookieWithRetry(idToken: string): Promise<boolean> {
  const MAX_SESSION_RETRIES = 2;
  const SESSION_RETRY_DELAY = 500;

  for (let i = 0; i < MAX_SESSION_RETRIES; i++) {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      if (response.ok) return true;
      if (response.status >= 400 && response.status < 500) return false;
    } catch (error) {
      // Network error
    }
    if (i < MAX_SESSION_RETRIES - 1) {
      await new Promise(res => setTimeout(res, SESSION_RETRY_DELAY * (i + 1)));
    }
  }
  return false;
}


async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/session', { 
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    console.error('❌ Failed to clear session cookie:', error);
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

function navigateTo(path: string) {
  if (typeof window === 'undefined') return;
  window.location.href = path;
}

// --- AuthProvider Component ---

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(['toast']);
  
  const authOperationLock = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleAuthError = useCallback((err: any) => {
    let message = t('toast:genericError');
    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        message = t('toast:invalidCredentials');
        break;
      case 'auth/email-already-in-use':
        message = t('toast:emailInUse');
        break;
      case 'auth/weak-password':
        message = t('toast:weakPassword');
        break;
      case 'auth/invalid-email':
        message = t('toast:invalidEmail');
        break;
      case 'auth/popup-closed-by-user':
        message = t('toast:popupClosed');
        break;
      case 'auth/too-many-requests':
        message = t('toast:tooManyRequests');
        break;
      case 'auth/network-request-failed':
        message = t('toast:networkError');
        break;
      default:
        console.error('[AUTH] Unhandled auth error:', err);
    }
    setError(message);
    return message;
  }, [t]);

  const performAuthOperation = useCallback(async (
    operation: () => Promise<FirebaseUser | null>,
    validateInputs?: () => string | null
  ): Promise<boolean> => {
    
    if (authOperationLock.current) {
      return authOperationLock.current;
    }

    const operationPromise = (async () => {
      const validationError = validateInputs?.();
      if (validationError) {
        setError(validationError);
        return false;
      }

      setIsSigningIn(true);
      setError(null);
      
      try {
        const user = await operation();
        if (!user) throw new Error("Authentication failed: No user returned.");
        
        const idToken = await user.getIdToken(true);
        const cookieSet = await setSessionCookieWithRetry(idToken);
        
        if (!cookieSet) throw new ApiServiceError("Could not create a server session. Please try again.", 'UNAVAILABLE');
        
        navigateTo('/library/book');
        return true;
      } catch (err: any) {
        handleAuthError(err);
        return false;
      } finally {
        setIsSigningIn(false);
        authOperationLock.current = null;
      }
    })();

    authOperationLock.current = operationPromise;
    return operationPromise;
  }, [handleAuthError]);

  const signUpWithEmail = useCallback((email: string, pass: string) => 
    performAuthOperation(
      () => createUserWithEmailAndPassword(auth, email, pass).then(c => c.user),
      () => {
        if (!isValidEmail(email)) return t('toast:invalidEmail');
        if (!isValidPassword(pass)) return t('toast:weakPassword');
        return null;
      }
    ),
    [performAuthOperation, t]
  );

  const signInWithEmail = useCallback((email: string, pass: string) => 
    performAuthOperation(
      () => signInWithEmailAndPassword(auth, email, pass).then(c => c.user),
      () => {
        if (!isValidEmail(email)) return t('toast:invalidEmail');
        return null;
      }
    ),
    [performAuthOperation, t]
  );
  
  const signInWithGoogle = useCallback(() => 
    performAuthOperation(() => signInWithPopup(auth, new GoogleAuthProvider()).then(c => c.user)),
    [performAuthOperation]
  );

  const logout = useCallback(async (): Promise<void> => {
    if (authOperationLock.current) await authOperationLock.current;
    try {
      await signOut(auth);
      await clearSessionCookie();
      navigateTo('/login?reason=logged_out');
    } catch (error) {
      console.error('❌ [AUTH] Logout error:', error);
      navigateTo('/login?reason=error');
    }
  }, []);

  const clearAuthError = useCallback(() => setError(null), []);

  const value: AuthContextType = { 
    authUser, 
    loading, 
    isSigningIn,
    error,
    logout, 
    signUpWithEmail, 
    signInWithEmail,
    signInWithGoogle,
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
