// src/contexts/user-context.tsx
"use client";

import { createContext, useContext } from 'react';
import type { User } from '@/lib/types';

/**
 * @fileoverview Defines the shape and context for user data.
 * This file should only contain the type definitions, the context object,
 * and the consumer hook. The provider implementation is in a separate file.
 */

export interface LevelUpInfo {
  newLevel: number;
  oldLevel: number;
}

// 1. Define the shape of the context data
export interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  levelUpInfo: LevelUpInfo | null;
  clearLevelUpInfo: () => void;
  reloadUser: () => Promise<void>;
  retryUserFetch: () => void;
}

// 2. Create the context with a default undefined value
export const UserContext = createContext<UserContextType | undefined>(undefined);

// 3. Create the consumer hook
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
