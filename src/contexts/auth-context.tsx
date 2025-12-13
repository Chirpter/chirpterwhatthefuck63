// src/contexts/auth-context.tsx
"use client";

import { createContext, useContext } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

/**
 * @fileoverview Defines the shape and context for authentication.
 * This file should only contain the type definitions, the context object,
 * and the consumer hook. The provider implementation is in a separate file.
 */

// 1. Define the shape of the context data
export interface AuthContextType {
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

// 2. Create the context with a default undefined value
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Create the consumer hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
