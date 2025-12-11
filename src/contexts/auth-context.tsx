// src/contexts/auth-context.tsx - WITH PERFORMANCE MONITORING
"use client";

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
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

// ⏱️ PERFORMANCE LOGGER
const perfLog = (label: string, startTime: number) => {
  const duration = performance.now() - startTime;
  const color = duration < 100 ? '🟢' : duration < 300 ? '🟡' : '🔴';
  console.log(`${color} [PERF] ${label}: ${duration.toFixed(2)}ms`);
  return duration;
};

interface AuthContextType {
  authUser: FirebaseUser | null;
  loading: boolean;
  isSigningIn: boolean;
  error: string | null;
  signUpWithEmail: (email: string, pass: string) => Promise<boolean>;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function setSessionCookie(idToken: string): Promise<boolean> {
  const startTime = performance.now();
  console.log('🚀 [AUTH] Starting session cookie creation...');
  
  try {
    const fetchStart = performance.now();
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });
    
    perfLog('API /api/auth/session fetch', fetchStart);
    
    if (response.ok) {
      perfLog('✅ Total session cookie creation', startTime);
      return true;
    }
    
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ [AUTH] Session API error:', errorData);
    perfLog('❌ Failed session cookie creation', startTime);
    return false;
    
  } catch (error) {
    console.error('❌ [AUTH] Network error:', error);
    perfLog('❌ Failed session cookie creation (network)', startTime);
    return false;
  }
}

async function clearSessionCookie(): Promise<void> {
  const startTime = performance.now();
  try {
    await fetch('/api/auth/session', { 
      method: 'DELETE',
      credentials: 'include',
    });
    perfLog('Session cookie cleared', startTime);
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
  
  const startTime = performance.now();
  console.log(`🧭 [NAV] Navigating to: ${path}`);
  
  if (typeof (window.location.assign as any).mockClear === 'function') {
    (window.location.assign as any)(path);
  } else {
    window.location.href = path;
  }
  
  perfLog('Navigation initiated', startTime);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  const authOperationLock = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    console.log('👂 [AUTH] Setting up auth state listener...');
    const listenerStart = performance.now();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      perfLog('Auth state changed', listenerStart);
      setAuthUser(user);
      setLoading(false);
    });
    
    return () => {
      console.log('🔌 [AUTH] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const handleAuthError = useCallback((err: any) => {
    let message = 'An unexpected error occurred. Please try again.';
    
    if (err.message?.includes('Could not create a server session')) {
      message = err.message;
    } else {
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          message = 'Invalid email or password.';
          break;
        case 'auth/email-already-in-use':
          message = 'This email is already registered. Please sign in.';
          break;
        case 'auth/weak-password':
          message = 'Password must be at least 6 characters long.';
          break;
        case 'auth/invalid-email':
          message = 'Invalid email address.';
          break;
        case 'auth/too-many-requests':
          message = 'Access temporarily disabled due to many failed attempts. Try again later or reset your password.';
          break;
        case 'auth/network-request-failed':
          message = 'Network error. Please check your connection and try again.';
          break;
        case 'auth/popup-closed-by-user':
          message = 'Sign-in popup was closed. Please try again.';
          break;
        default:
          console.error('[AUTH] Unhandled auth error:', err);
      }
    }
    
    setError(message);
  }, []);

  const performAuthOperation = useCallback(async (
    operation: () => Promise<FirebaseUser | null>,
    validateInputs?: () => string | null
  ): Promise<boolean> => {
    const operationStart = performance.now();
    console.log('🔐 [AUTH] Starting auth operation...');
    
    if (validateInputs) {
      const validationError = validateInputs();
      if (validationError) {
        setError(validationError);
        return false;
      }
    }
    
    if (authOperationLock.current) {
      console.warn('⚠️  [AUTH] Operation already in progress');
      return authOperationLock.current;
    }

    const operationPromise = (async () => {
      setIsSigningIn(true);
      setError(null);
      
      try {
        // Step 1: Firebase Auth
        const firebaseStart = performance.now();
        const user = await operation();
        perfLog('Firebase Auth', firebaseStart);
        
        if (!user) throw new Error("Authentication failed: No user returned.");
        
        // Step 2: Get ID Token
        const tokenStart = performance.now();
        const idToken = await user.getIdToken(true);
        perfLog('Get ID Token', tokenStart);
        
        // Step 3: Create Session Cookie
        const cookieStart = performance.now();
        const cookieSet = await setSessionCookie(idToken);
        perfLog('Session Cookie Creation', cookieStart);
        
        if (!cookieSet) {
          throw new Error("Could not create a server session. Please try again.");
        }
        
        // Step 4: Navigation
        perfLog('🎉 TOTAL AUTH OPERATION', operationStart);
        navigateTo('/library/book');
        
        return true;

      } catch (err: any) {
        console.error('❌ [AUTH] Operation failed:', err);
        perfLog('❌ Failed auth operation', operationStart);
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
        if (!isValidEmail(email)) return 'Please enter a valid email address.';
        if (!isValidPassword(pass)) return 'Password must be at least 6 characters long.';
        return null;
      }
    ),
    [performAuthOperation]
  );

  const signInWithEmail = useCallback((email: string, pass: string) => 
    performAuthOperation(
      () => signInWithEmailAndPassword(auth, email, pass).then(c => c.user),
      () => {
        if (!isValidEmail(email)) return 'Please enter a valid email address.';
        if (!isValidPassword(pass)) return 'Password must be at least 6 characters long.';
        return null;
      }
    ),
    [performAuthOperation]
  );
  
  const signInWithGoogle = useCallback(() => 
    performAuthOperation(() => signInWithPopup(auth, new GoogleAuthProvider()).then(c => c.user)),
    [performAuthOperation]
  );

  const logout = useCallback(async (): Promise<void> => {
    const logoutStart = performance.now();
    console.log('🚪 [AUTH] Starting logout...');
    
    if (authOperationLock.current) {
      console.log('⏳ [AUTH] Waiting for ongoing operation...');
      await authOperationLock.current;
    }
    
    try {
      const firebaseLogoutStart = performance.now();
      await signOut(auth);
      perfLog('Firebase signOut', firebaseLogoutStart);
      
      const cookieClearStart = performance.now();
      await clearSessionCookie();
      perfLog('Clear session cookie', cookieClearStart);
      
      perfLog('🎉 TOTAL LOGOUT', logoutStart);
      navigateTo('/login?reason=logged_out');
    } catch (error) {
      console.error('❌ [AUTH] Logout error:', error);
      perfLog('❌ Failed logout', logoutStart);
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};