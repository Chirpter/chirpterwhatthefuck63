// src/contexts/auth-context.tsx - PRODUCTION READY (OPTIMIZED)
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

// --- Type Definition ---
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

// --- Helper Functions ---

/**
 * ✅ OPTIMIZED: Faster cookie polling with exponential backoff
 */
async function waitForCookie(cookieName: string, maxWait = 2000): Promise<boolean> {
  const startTime = Date.now();
  let checkInterval = 50; // Start with 50ms
  
  while (Date.now() - startTime < maxWait) {
    const cookies = document.cookie.split(';');
    const found = cookies.find(c => c.trim().startsWith(`${cookieName}=`));
    
    if (found && found.split('=')[1]?.length > 10) {
      console.log(`✅ [Auth] Cookie found after ${Date.now() - startTime}ms`);
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    checkInterval = Math.min(checkInterval * 1.5, 200); // Exponential backoff, max 200ms
  }
  
  console.warn(`⚠️ [Auth] Cookie not found after ${maxWait}ms timeout`);
  return false;
}

/**
 * ✅ OPTIMIZED: Better retry logic with proper error handling
 */
async function setSessionCookie(idToken: string, maxRetries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [Auth] Session cookie attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      
      if (response.ok) {
        // ✅ FIX: Wait for cookie with optimized polling
        const cookieSet = await waitForCookie('__session', 2000);
        
        if (cookieSet) {
          console.log('✅ [Auth] Session cookie verified successfully');
          return true;
        }
        
        if (attempt < maxRetries) {
          console.warn(`⚠️ [Auth] Cookie not found after attempt ${attempt}, retrying...`);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ [Auth] Session API error (attempt ${attempt}):`, errorData);
        
        // ✅ FIX: Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          console.error('❌ [Auth] Client error, not retrying');
          return false;
        }
      }
      
      // Exponential backoff
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
      }
      
    } catch (error) {
      console.error(`❌ [Auth] Session cookie attempt ${attempt} failed:`, error);
      
      // ✅ FIX: For network errors, fail fast on last attempt
      if (error instanceof Error && error.message.includes('Network')) {
        console.error('❌ [Auth] Network error detected');
        if (attempt === maxRetries) return false;
      }
      
      if (attempt === maxRetries) return false;
      await new Promise(resolve => setTimeout(resolve, 300 * attempt));
    }
  }
  
  console.error('❌ [Auth] Failed to set session cookie after all retries');
  return false;
}

/**
 * ✅ OPTIMIZED: Faster cookie cleanup
 */
async function clearSessionCookie(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/session', { method: 'DELETE' });
    
    // ✅ FIX: Don't wait unnecessarily, cookie deletion is immediate
    return response.ok;
  } catch (error) {
    console.error('❌ [Auth] Failed to clear session cookie:', error);
    return false;
  }
}

// --- Auth Provider Component ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Promise-based lock to prevent concurrent operations
  const authOperationLock = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthError = useCallback((err: any) => {
    let message = 'An unexpected error occurred. Please try again.';
    
    // ✅ FIX: Check for specific error strings from our flow
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
        case 'auth/too-many-requests':
          message = 'Access temporarily disabled due to many failed attempts. Try again later or reset your password.';
          break;
        case 'auth/network-request-failed':
          message = 'Network error. Please check your connection and try again.';
          break;
        default:
          console.error('[AuthContext] Unhandled auth error:', err);
      }
    }
    
    setError(message);
  }, []);

  /**
   * ✅ OPTIMIZED: Performs auth operation with proper locking mechanism
   */
  const performAuthOperation = useCallback(async (
    operation: () => Promise<FirebaseUser | null>
  ): Promise<boolean> => {
    // If there's an ongoing operation, wait for it
    if (authOperationLock.current) {
      console.warn('[Auth] Operation already in progress, waiting...');
      return authOperationLock.current;
    }

    // Create new operation promise
    const operationPromise = (async () => {
      setIsSigningIn(true);
      setError(null);
      
      try {
        const user = await operation();
        if (!user) throw new Error("Authentication failed: No user returned.");
        
        const idToken = await user.getIdToken(true);
        const cookieSet = await setSessionCookie(idToken);
        
        if (!cookieSet) {
          throw new Error("Could not create a server session. Please try again.");
        }
        
        // ✅ FIX: Use window.location for cleaner navigation after login
        // In tests, window.location.href throws in jsdom, so we check if assign exists
        if (typeof window !== 'undefined' && window.location.assign) {
          window.location.assign('/library/book');
        } else if (typeof window !== 'undefined') {
          window.location.href = '/library/book';
        }
        
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
    performAuthOperation(() => createUserWithEmailAndPassword(auth, email, pass).then(c => c.user)),
    [performAuthOperation]
  );

  const signInWithEmail = useCallback((email: string, pass: string) => 
    performAuthOperation(() => signInWithEmailAndPassword(auth, email, pass).then(c => c.user)),
    [performAuthOperation]
  );
  
  const signInWithGoogle = useCallback(() => 
    performAuthOperation(() => signInWithPopup(auth, new GoogleAuthProvider()).then(c => c.user)),
    [performAuthOperation]
  );

  /**
   * ✅ OPTIMIZED: Logout with proper cleanup and navigation
   */
  const logout = useCallback(async (): Promise<void> => {
    // Wait for any ongoing auth operation
    if (authOperationLock.current) {
      console.warn('[Auth] Waiting for ongoing operation before logout...');
      await authOperationLock.current;
    }
    
    try {
      await signOut(auth);
      await clearSessionCookie();
      
      // ✅ FIX: Use window.location for cleaner navigation after logout
      // In tests, window.location.href throws in jsdom, so we check if assign exists
      if (typeof window !== 'undefined' && window.location.assign) {
        window.location.assign('/login?reason=logged_out');
      } else if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=logged_out';
      }
    } catch (error) {
      console.error('[AuthContext] Error during logout:', error);
      // Force logout even on error
      if (typeof window !== 'undefined' && window.location.assign) {
        window.location.assign('/login?reason=error');
      } else if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=error';
      }
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