
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

async function setSessionCookie(idToken: string, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Session creation failed: ${errorData.error || response.statusText}`);
      }
      return true;
    } catch (error) {
      console.error(`Session cookie attempt ${attempt} failed:`, error);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  return false;
}

async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch (error) {
    console.error('⚠️ Failed to clear session cookie:', error);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentAuthUser) => {
      setAuthUser(currentAuthUser);
      setLoading(false);
    });
    return () => unsubscribe();
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
        console.error("Authentication Error:", err);
        logAuthEvent('auth_error', { error: err.code || err.message || 'unknown' });
    }
    setError(message);
  };
  
  const performAuthOperation = async (operation: () => Promise<FirebaseUser | null>, emailForRateLimit?: string): Promise<boolean> => {
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
      const user = await operation();
      if (!user) { // Operation might be cancelled (e.g. Google popup closed)
          setIsSigningIn(false);
          return false;
      }
      
      const idToken = await user.getIdToken();
      await setSessionCookie(idToken);
      
      if (emailForRateLimit) clearFailedAttempts(emailForRateLimit);
      
      return true; // Success
    } catch (err: any) {
      if (emailForRateLimit) recordFailedAttempt(emailForRateLimit);
      handleAuthError(err);
      return false; // Failure
    } finally {
      setIsSigningIn(false);
    }
  };

  const signUpWithEmail = (email: string, pass: string) => 
    performAuthOperation(() => createUserWithEmailAndPassword(auth, email, pass).then(cred => cred.user), email);

  const signInWithEmail = (email: string, pass: string) => 
    performAuthOperation(() => signInWithEmailAndPassword(auth, email, pass).then(cred => cred.user), email);

  const signInWithGoogle = () => 
    performAuthOperation(() => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider).then(cred => cred.user).catch(err => {
            handleAuthError(err);
            return null; // Return null on popup close/block
        });
    });

  const logout = async () => {
    try {
      await signOut(auth);
      await clearSessionCookie();
      logAuthEvent('logout');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      window.location.href = '/login';
    }
  };

  const clearAuthError = () => setError(null);

  const value = { 
    authUser, 
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
