
"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
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
import { logAuthEvent } from '@/lib/analytics';
import { checkRateLimit, recordFailedAttempt, clearFailedAttempts } from '@/lib/rate-limit';

interface AuthContextType {
  authUser: FirebaseUser | null;
  isSessionReady: boolean; // NEW: Track if server session is set
  loading: boolean;
  error: string | null;
  isSigningIn: boolean;
  signUpWithEmail: (email: string, pass: string) => Promise<boolean>;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Improved session cookie creation with better error handling
async function setSessionCookie(idToken: string, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Auth] Creating session cookie (attempt ${attempt}/${retries})...`);
      
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include', // Important for cookies
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Session creation failed: ${errorData.error || response.statusText}`);
      }
      
      console.log('[Auth] ✅ Session cookie created successfully');
      return true;
    } catch (error) {
      console.error(`[Auth] Session cookie attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  return false;
}

async function clearSessionCookie(): Promise<void> {
  try {
    console.log('[Auth] Clearing session cookie...');
    await fetch('/api/auth/session', { 
      method: 'DELETE',
      credentials: 'include'
    });
    console.log('[Auth] ✅ Session cookie cleared');
  } catch (error) {
    console.error('[Auth] ⚠️ Failed to clear session cookie:', error);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false); // NEW STATE
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[Auth] Setting up auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, (currentAuthUser) => {
      console.log('[Auth] Auth state changed:', currentAuthUser ? 'User logged in' : 'User logged out');
      setAuthUser(currentAuthUser);
      if (!currentAuthUser) {
        setIsSessionReady(false); // Reset session readiness on logout
      }
      setLoading(false);
    });
    
    return () => {
      console.log('[Auth] Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  const handleAuthError = (err: any) => {
    let message = 'An unexpected error occurred. Please try again.';
    
    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        message = 'Invalid email or password. Please try again.';
        logAuthEvent('login_failed', { reason: 'invalid_credentials' });
        break;
      case 'auth/email-already-in-use':
        message = 'This email address is already registered. Please sign in.';
        break;
      case 'auth/weak-password':
        message = 'Password should be at least 6 characters long.';
        break;
      case 'auth/invalid-email':
        message = 'Please enter a valid email address.';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later.';
        logAuthEvent('rate_limit_hit', { reason: 'too_many_requests' });
        break;
      case 'auth/popup-closed-by-user':
        message = 'Sign-in was cancelled. Please try again.';
        break;
      case 'auth/popup-blocked':
        message = 'Popup was blocked. Please allow popups and try again.';
        break;
      default:
        console.error("[Auth] Authentication Error:", err);
        logAuthEvent('auth_error', { error: err.code || err.message || 'unknown' });
    }
    
    setError(message);
  };
  
  const performAuthOperation = async (
    operation: () => Promise<FirebaseUser | null>, 
    emailForRateLimit?: string
  ): Promise<boolean> => {
    if (emailForRateLimit) {
      const rateLimitCheck = checkRateLimit(emailForRateLimit);
      if (!rateLimitCheck.allowed) {
        setError(`Too many failed attempts. Please try again in ${Math.ceil(rateLimitCheck.waitTime / 60)} minutes.`);
        return false;
      }
    }
    
    setIsSigningIn(true);
    setError(null);
    
    try {
      console.log('[Auth] Starting auth operation...');
      const user = await operation();
      if (!user) {
        setIsSigningIn(false);
        return false;
      }
      
      console.log('[Auth] User authenticated, getting ID token...');
      const idToken = await user.getIdToken(true);
      
      console.log('[Auth] Creating session cookie...');
      const cookieSet = await setSessionCookie(idToken);
      
      if (!cookieSet) {
        throw new Error('Server failed to set session cookie.');
      }
      
      setIsSessionReady(true); // ✅ Critical: Mark session as ready ONLY after cookie is set

      if (emailForRateLimit) {
        clearFailedAttempts(emailForRateLimit);
      }
      
      console.log('[Auth] ✅ Auth operation completed successfully');
      return true;
      
    } catch (err: any) {
      console.error('[Auth] Auth operation failed:', err);
      if (emailForRateLimit) recordFailedAttempt(emailForRateLimit);
      handleAuthError(err);
      setIsSessionReady(false); // Ensure session is not considered ready on failure
      return false;
      
    } finally {
      setIsSigningIn(false);
    }
  };

  const signUpWithEmail = (email: string, pass: string) => 
    performAuthOperation(() => createUserWithEmailAndPassword(auth, email, pass).then(c => c.user), email);

  const signInWithEmail = (email: string, pass: string) => 
    performAuthOperation(() => signInWithEmailAndPassword(auth, email, pass).then(c => c.user), email);

  const signInWithGoogle = () => 
    performAuthOperation(() => signInWithPopup(auth, new GoogleAuthProvider()).then(c => c.user).catch(err => {
      handleAuthError(err);
      return null;
    }));

  const logout = async () => {
    console.log('[Auth] Logging out...');
    try {
      // Clear server session first
      await clearSessionCookie();
      // Then sign out from Firebase client
      await signOut(auth);
      // Finally, reset local state
      setIsSessionReady(false);
      console.log('[Auth] ✅ Logout completed successfully');
    } catch (error) {
      console.error('[Auth] ❌ Logout failed:', error);
      // Force a page reload to clear state as a fallback
      window.location.href = '/login';
    }
  };

  const clearAuthError = () => setError(null);

  const value = { 
    authUser, 
    isSessionReady,
    loading, 
    error,
    isSigningIn,
    logout, 
    signUpWithEmail, 
    signInWithEmail,
    signInWithGoogle,
    clearAuthError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
