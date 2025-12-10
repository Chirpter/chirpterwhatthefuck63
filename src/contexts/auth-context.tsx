// src/contexts/auth-context.tsx - CẢI TIẾN
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
async function setSessionCookie(idToken: string, maxRetries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      
      if (response.ok) {
        // ✅ FIX: Verify cookie was actually set
        const cookieSet = document.cookie.includes('__session=');
        if (cookieSet) return true;
        
        // Cookie not found, retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          continue;
        }
      }
      
      if (attempt === maxRetries) return false;
      
      // Exponential backoff for retries
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      
    } catch (error) {
      console.error(`[Auth] Session cookie attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) return false;
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
    }
  }
  return false;
}

async function clearSessionCookie(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/session', { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('[Auth] Failed to clear session cookie:', error);
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
  
  // ✅ FIX: Use ref to prevent multiple concurrent auth operations
  const authOperationInProgress = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthError = useCallback((err: any) => {
    let message = 'An unexpected error occurred. Please try again.';
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
    setError(message);
  }, []);

  const performAuthOperation = useCallback(async (
    operation: () => Promise<FirebaseUser | null>
  ): Promise<boolean> => {
    // ✅ FIX: Prevent concurrent operations
    if (authOperationInProgress.current) {
      console.warn('[Auth] Operation already in progress');
      return false;
    }

    authOperationInProgress.current = true;
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
      
      // ✅ FIX: Use router.push with proper cache invalidation
      router.push('/library/book');
      router.refresh(); // Force server components to re-fetch
      
      return true;

    } catch (err: any) {
      handleAuthError(err);
      return false;
    } finally {
      setIsSigningIn(false);
      authOperationInProgress.current = false;
    }
  }, [handleAuthError, router]);

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

  const logout = useCallback(async () => {
    // ✅ FIX: Prevent logout during auth operation
    if (authOperationInProgress.current) {
      console.warn('[Auth] Cannot logout during active auth operation');
      return;
    }
    
    authOperationInProgress.current = true;
    
    try {
      await signOut(auth);
      await clearSessionCookie();
      
      // ✅ FIX: Use router instead of window.location
      router.push('/login?reason=logged_out');
      router.refresh();
    } catch (error) {
      console.error('[AuthContext] Error during logout:', error);
      // Force logout even on error
      router.push('/login?reason=error');
      router.refresh();
    } finally {
      authOperationInProgress.current = false;
    }
  }, [router]);

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