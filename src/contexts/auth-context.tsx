// src/contexts/auth-context.tsx

"use client";

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
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
  loading: boolean; // True while Firebase is initializing its state
  isSigningIn: boolean; // True ONLY during the async login/signup process
  error: string | null;
  signUpWithEmail: (email: string, pass: string) => Promise<boolean>;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to call our API route to set the session cookie
async function setSessionCookie(idToken: string): Promise<boolean> {
  try {
    console.log("[Auth] Attempting to set session cookie...");
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API responded with status ${response.status}`);
    }
    
    console.log("[Auth] ✅ Session cookie set successfully.");
    return true;
  } catch (error) {
    console.error("[Auth] ❌ Failed to set session cookie:", error);
    return false;
  }
}

// Helper to call our API route to clear the session cookie
async function clearSessionCookie(): Promise<void> {
  try {
    console.log("[Auth] Attempting to clear session cookie...");
    await fetch('/api/auth/session', { method: 'DELETE' });
    console.log("[Auth] ✅ Session cookie cleared request sent.");
  } catch (error) {
    console.warn("[Auth] ⚠️  Failed to clear session cookie:", error);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log(`[Auth] State changed. User: ${user ? user.uid : 'null'}`);
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
        message = 'Too many failed attempts. Please try again later.';
        break;
      // Add other common Firebase error codes as needed
      default:
        console.error('[Auth] Unhandled auth error:', err);
    }
    setError(message);
    logAuthEvent('login_failed', { error_code: err.code, error_message: message });
  }, []);

  const performAuthOperation = useCallback(async (
    operation: () => Promise<FirebaseUser | null>, 
    emailForRateLimit?: string
  ): Promise<boolean> => {
    // Rate limit check
    if (emailForRateLimit) {
      const { allowed, waitTime } = checkRateLimit(emailForRateLimit);
      if (!allowed) {
        setError(`Too many attempts. Try again in ${Math.ceil(waitTime / 60)} minutes.`);
        return false;
      }
    }
    
    setIsSigningIn(true);
    setError(null);
    
    try {
      // 1. Perform the Firebase auth operation (e.g., signInWithEmailAndPassword)
      const user = await operation();
      if (!user) {
        throw new Error("Authentication failed: No user returned.");
      }
      
      // 2. Get the ID token from the authenticated user
      const idToken = await user.getIdToken(true);
      
      // 3. Send the token to our API to create a session cookie
      const cookieSet = await setSessionCookie(idToken);
      if (!cookieSet) {
        throw new Error("Could not create a server session.");
      }
      
      // 4. On success, clear any previous failed attempts
      if (emailForRateLimit) {
        clearFailedAttempts(emailForRateLimit);
      }
      
      console.log("[Auth] ✅ Full auth flow successful.");
      return true;

    } catch (err: any) {
      if (emailForRateLimit) {
        recordFailedAttempt(emailForRateLimit);
      }
      handleAuthError(err);
      return false;
      
    } finally {
      setIsSigningIn(false);
    }
  }, [handleAuthError]);

  // --- Public API Functions ---

  const signUpWithEmail = useCallback((email: string, pass: string) => 
    performAuthOperation(() => createUserWithEmailAndPassword(auth, email, pass).then(c => c.user), email),
    [performAuthOperation]
  );

  const signInWithEmail = useCallback((email: string, pass: string) => 
    performAuthOperation(() => signInWithEmailAndPassword(auth, email, pass).then(c => c.user), email),
    [performAuthOperation]
  );
  
  const signInWithGoogle = useCallback(() => 
    performAuthOperation(() => signInWithPopup(auth, new GoogleAuthProvider()).then(c => c.user)),
    [performAuthOperation]
  );

  const logout = useCallback(async () => {
    console.log('[Auth] 🚪 Starting logout...');
    try {
      // 1. Sign out from Firebase client-side SDK
      await signOut(auth);
      
      // 2. Clear the server-side session cookie by calling our API
      await clearSessionCookie();
      
      // 3. Force a reload. The middleware will see no session and redirect to /login.
      // This is the most reliable way to clear all state.
      window.location.href = '/login?reason=logged_out';
    } catch (error) {
      console.error('[Auth] ❌ Logout error:', error);
      // Fallback: still try to redirect
      window.location.href = '/login?reason=logout_error';
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
