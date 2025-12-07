// src/contexts/auth-context.tsx
"use client";

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
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
async function setSessionCookie(idToken: string): Promise<boolean> {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  return response.ok;
}

async function clearSessionCookie(): Promise<boolean> {
  const response = await fetch('/api/auth/session', { method: 'DELETE' });
  return response.ok;
}

// --- Auth Provider Component ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
        message = 'Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.';
        break;
      default:
        console.error('[AuthContext] Unhandled auth error:', err);
    }
    setError(message);
  }, []);

  const performAuthOperation = useCallback(async (operation: () => Promise<FirebaseUser | null>): Promise<boolean> => {
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
      
      // Use hard navigation to ensure full page reload and state reset
      window.location.href = '/library/book';
      return true;

    } catch (err: any) {
      handleAuthError(err);
      return false;
    } finally {
      // In case of success, the page reloads. In case of error, we set signing in to false.
      setIsSigningIn(false);
    }
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

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      await clearSessionCookie();
    } catch (error) {
      console.error('[AuthContext] Error during logout process:', error);
    } finally {
      // Use hard navigation to ensure full page reload and state reset
      window.location.href = '/login';
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
