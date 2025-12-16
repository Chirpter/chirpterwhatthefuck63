// src/providers/auth-provider.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useTranslation } from 'react-i18next';
import { ApiServiceError } from '@/lib/errors';

// --- Helper Functions ---

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

function navigateTo(path: string) {
    if (typeof window === 'undefined') return;
    // Use window.location.href for a full page reload, which is cleaner after auth state changes.
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

  // ✅ REFACTORED: This function now ONLY handles the Firebase auth operation.
  // It returns true/false to signal success/failure to the caller (LoginView).
  // No more cookie setting or navigation.
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
        
        // Wait for the auth state to propagate before returning success
        await new Promise<void>(resolve => {
            const unsub = onAuthStateChanged(auth, (u) => {
                if (u?.uid === user.uid) {
                    unsub();
                    resolve();
                }
            });
        });
        
        return true; // SUCCESS! Signal to the caller.
      } catch (err: any) {
        handleAuthError(err);
        return false; // FAILURE! Signal to the caller.
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
      
      // Post to the logout API endpoint first to clear server session
      try {
        await fetch('/api/auth/session', { 
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (error) {
        console.warn('❌ [AUTH] Failed to clear session cookie via API, continuing with client logout.', error);
      }
      
      // Then sign out from Firebase client
      try {
        await signOut(auth);
        navigateTo('/login?reason=logged_out');
      } catch (error) {
        console.error('❌ [AUTH] Client logout error:', error);
        // Force navigation even if client logout fails, as server session is gone.
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
