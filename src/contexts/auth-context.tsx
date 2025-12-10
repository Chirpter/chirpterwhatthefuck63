// src/contexts/auth-context.tsx - PRODUCTION READY (FIXED COOKIE ISSUE)
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
 * ✅ FIXED: Verify cookie is set by making a validation request
 * The __session cookie is HttpOnly, so we can't read it from document.cookie
 */
async function verifyCookieSet(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    });
    return response.ok;
  } catch (error) {
    console.error('❌ [Auth] Failed to verify cookie:', error);
    return false;
  }
}

/**
 * ✅ FIXED: Simpler session creation - don't wait for document.cookie
 */
async function setSessionCookie(idToken: string, maxRetries = 2): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [Auth] Session cookie attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      
      if (response.ok) {
        console.log('✅ [Auth] Session API returned success');
        
        // Small delay to ensure cookie is set in browser
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify cookie works by making a test request
        const verified = await verifyCookieSet();
        if (verified) {
          console.log('✅ [Auth] Session cookie verified');
          return true;
        }
        
        console.warn(`⚠️ [Auth] Cookie not verified on attempt ${attempt}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ [Auth] Session API error (attempt ${attempt}):`, errorData);
        
        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          console.error('❌ [Auth] Client error, not retrying');
          return false;
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        }
      }
      
    } catch (error) {
      console.error(`❌ [Auth] Session cookie attempt ${attempt} failed:`, error);
      
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
    const response = await fetch('/api/auth/session', { 
      method: 'DELETE',
      credentials: 'include',
    });
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
        
        // Use window.location for cleaner navigation after login
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
      
      // Use window.location for cleaner navigation after logout
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