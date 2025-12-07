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
  isSessionReady: boolean;
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

async function setSessionCookie(idToken: string, maxRetries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Auth] Setting session cookie (attempt ${attempt}/${maxRetries})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      console.log('[Auth] ✅ Session cookie set successfully');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
      
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[Auth] ❌ Session cookie attempt ${attempt} failed:`, errorMsg);
      
      if (isLastAttempt) {
        throw new Error(`Failed to set session after ${maxRetries} attempts: ${errorMsg}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  return false;
}

async function clearSessionCookie(): Promise<void> {
  try {
    console.log('[Auth] Clearing session cookie...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    await fetch('/api/auth/session', { 
      method: 'DELETE',
      credentials: 'include',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('[Auth] ✅ Session cookie cleared');
    
  } catch (error) {
    console.warn('[Auth] ⚠️  Failed to clear session cookie:', error);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[Auth] 👂 Setting up auth state listener');
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const status = currentUser ? `✅ User: ${currentUser.uid}` : '🚫 No user';
      console.log(`[Auth] State changed: ${status}`);
      
      setAuthUser(currentUser);
      
      if (!currentUser) {
        setIsSessionReady(false);
      }
      
      setLoading(false);
    });
    
    return () => {
      console.log('[Auth] 🔌 Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const handleAuthError = useCallback((err: any) => {
    let message = 'An unexpected error occurred. Please try again.';
    let eventData: Record<string, any> = {};
    
    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        message = 'Invalid email or password. Please try again.';
        eventData = { reason: 'invalid_credentials' };
        logAuthEvent('login_failed', eventData);
        break;
        
      case 'auth/email-already-in-use':
        message = 'This email is already registered. Please sign in instead.';
        break;
        
      case 'auth/weak-password':
        message = 'Password must be at least 6 characters long.';
        break;
        
      case 'auth/invalid-email':
        message = 'Please enter a valid email address.';
        break;
        
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later.';
        eventData = { reason: 'too_many_requests' };
        logAuthEvent('rate_limit_hit', eventData);
        break;
        
      case 'auth/popup-closed-by-user':
        message = 'Sign-in cancelled. Please try again if needed.';
        break;
        
      case 'auth/popup-blocked':
        message = 'Popup blocked. Please allow popups and try again.';
        break;
        
      case 'auth/network-request-failed':
        message = 'Network error. Please check your connection and try again.';
        break;
        
      default:
        console.error('[Auth] ❌ Unhandled error:', err);
        eventData = { error: err.code || err.message || 'unknown' };
        logAuthEvent('auth_error', eventData);
    }
    
    setError(message);
  }, []);
  
  const performAuthOperation = useCallback(async (
    operation: () => Promise<FirebaseUser | null>, 
    emailForRateLimit?: string
  ): Promise<boolean> => {
    if (emailForRateLimit) {
      const rateLimitCheck = checkRateLimit(emailForRateLimit);
      if (!rateLimitCheck.allowed) {
        const waitMinutes = Math.ceil(rateLimitCheck.waitTime / 60);
        setError(`Too many failed attempts. Try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`);
        return false;
      }
    }
    
    setIsSigningIn(true);
    setError(null);
    
    try {
      console.log('[Auth] 🔐 Starting authentication...');
      const user = await operation();
      
      if (!user) {
        console.warn('[Auth] ⚠️  Auth operation returned no user');
        return false;
      }
      
      console.log(`[Auth] ✅ User authenticated: ${user.uid}`);
      console.log('[Auth] 🎫 Getting ID token...');
      
      const idToken = await user.getIdToken(true);
      
      console.log('[Auth] 🍪 Creating session cookie...');
      await setSessionCookie(idToken);
      
      setIsSessionReady(true);
      
      if (emailForRateLimit) {
        clearFailedAttempts(emailForRateLimit);
      }
      
      console.log('[Auth] 🎉 Authentication completed successfully');
      return true;
      
    } catch (err: any) {
      console.error('[Auth] ❌ Authentication failed:', err);
      
      if (emailForRateLimit) {
        recordFailedAttempt(emailForRateLimit);
      }
      
      handleAuthError(err);
      setIsSessionReady(false);
      return false;
      
    } finally {
      setIsSigningIn(false);
    }
  }, [handleAuthError]);

  const signUpWithEmail = useCallback((email: string, pass: string) => 
    performAuthOperation(
      () => createUserWithEmailAndPassword(auth, email, pass).then(c => c.user), 
      email
    ), [performAuthOperation]);

  const signInWithEmail = useCallback((email: string, pass: string) => 
    performAuthOperation(
      () => signInWithEmailAndPassword(auth, email, pass).then(c => c.user), 
      email
    ), [performAuthOperation]);

  const signInWithGoogle = useCallback(() => 
    performAuthOperation(
      () => signInWithPopup(auth, new GoogleAuthProvider())
        .then(c => c.user)
        .catch(err => {
          handleAuthError(err);
          return null;
        })
    ), [performAuthOperation, handleAuthError]);

  const logout = useCallback(async () => {
    console.log('[Auth] 🚪 Starting logout sequence...');
    
    try {
      // 🔥 CRITICAL: Clear local state FIRST to prevent redirects
      console.log('[Auth] 1️⃣ Clearing local auth state...');
      setAuthUser(null);
      setIsSessionReady(false);
      setError(null);
      
      // 2. Clear session cookie (non-blocking, best effort)
      console.log('[Auth] 2️⃣ Clearing session cookie...');
      await clearSessionCookie().catch(err => {
        console.warn('[Auth] Cookie clear failed (non-critical):', err);
      });
      
      // 3. Sign out from Firebase
      console.log('[Auth] 3️⃣ Signing out from Firebase...');
      await signOut(auth);
      
      console.log('[Auth] ✅ Logout completed');
      
      // 4. Hard redirect to login (bypass Next.js router to prevent state issues)
      console.log('[Auth] 4️⃣ Redirecting to login...');
      window.location.replace('/login?reason=logged_out');
      
    } catch (error) {
      console.error('[Auth] ❌ Logout error:', error);
      
      // Nuclear option: Force clear everything and redirect
      setAuthUser(null);
      setIsSessionReady(false);
      
      // Use replace instead of href to avoid back button issues
      window.location.replace('/login?reason=logout_error');
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = { 
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};