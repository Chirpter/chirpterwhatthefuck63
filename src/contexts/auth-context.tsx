
"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signOut, 
  type User as FirebaseUser, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { logAuthEvent } from '@/lib/analytics';

interface AuthContextType {
  authUser: FirebaseUser | null; 
  loading: boolean;
  logout: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<FirebaseUser>;
  signInWithEmail: (email: string, pass: string) => Promise<FirebaseUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ✅ IMPROVED: Better error handling and retry logic
async function setSessionCookie(idToken: string, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Attempting to set session cookie (attempt ${'${attempt}'}/${'${retries}'})`);
      
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Session creation failed: ${'${errorData.error || response.statusText}'}`);
      }
      
      console.log('✅ Session cookie set successfully');
      return true;
    } catch (error) {
      console.error(`❌ Session cookie attempt ${'${attempt}'} failed:`, error);
      
      // If this was the last attempt, throw the error
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  
  return false;
}

async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
    console.log('✅ Session cookie cleared');
  } catch (error) {
    console.error('⚠️ Failed to clear session cookie:', error);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const signUpWithEmail = async (email: string, pass: string) => {
    let userCredential;
    
    try {
      console.log('📝 Creating new user account...');
      userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      
      console.log('🔑 Getting ID token...');
      const idToken = await userCredential.user.getIdToken();
      
      console.log('🍪 Setting session cookie...');
      await setSessionCookie(idToken);
      
      logAuthEvent('sign_up', { method: 'email' });
      console.log('✅ Sign up completed successfully');
      return userCredential.user;
      
    } catch (error: any) {
      console.error('❌ Sign up failed:', error);
      
      // Rollback: Delete the user account if session creation failed
      if (userCredential) {
        console.warn('⚠️ Rolling back user creation...');
        try {
          await userCredential.user.delete();
          console.log('✅ User account rolled back successfully');
        } catch (deleteError) {
          console.error('❌ Failed to rollback user creation:', deleteError);
        }
      }
      
      throw error;
    }
  };
  
  const signInWithEmail = async (email: string, pass: string) => {
    let userCredential;
    
    try {
      console.log('🔐 Signing in user...');
      userCredential = await signInWithEmailAndPassword(auth, email, pass);
      
      console.log('🔑 Getting ID token...');
      const idToken = await userCredential.user.getIdToken();
      
      console.log('🍪 Setting session cookie...');
      await setSessionCookie(idToken);
      
      logAuthEvent('login', { method: 'email' });
      console.log('✅ Sign in completed successfully');
      return userCredential.user;
      
    } catch (error: any) {
      console.error('❌ Sign in failed:', error);
      
      // Rollback: Sign out if session creation failed
      if (userCredential) {
        console.warn('⚠️ Rolling back sign in...');
        try {
          await signOut(auth);
          console.log('✅ Sign in rolled back successfully');
        } catch (signOutError) {
          console.error('❌ Failed to rollback sign in:', signOutError);
        }
      }
      
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('👋 Logging out...');
      await signOut(auth);
      await clearSessionCookie();
      logAuthEvent('logout');
      console.log('✅ Logout completed successfully');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      // Fallback: Force redirect to login
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    console.log('👂 Setting up auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, (currentAuthUser) => {
      console.log('🔄 Auth state changed:', currentAuthUser ? 'User logged in' : 'No user');
      setAuthUser(currentAuthUser);
      setLoading(false);
    });

    return () => {
      console.log('🔇 Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  const value = { 
    authUser, 
    loading, 
    logout, 
    signUpWithEmail, 
    signInWithEmail, 
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
