// src/contexts/user-context.tsx
"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { createOrFetchUserProfile } from '@/services/user-service';

export interface LevelUpInfo {
  newLevel: number;
  oldLevel: number;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  levelUpInfo: LevelUpInfo | null;
  clearLevelUpInfo: () => void;
  reloadUser: () => Promise<void>;
  retryUserFetch: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<LevelUpInfo | null>(null);

  const fetchUser = useCallback(async (currentAuthUser: FirebaseUser) => {
    setLoading(true);
    setError(null);
    try {
      // Logic is now delegated to the user service
      const { user: userProfile, leveledUpInfo: levelUpData } = await createOrFetchUserProfile(currentAuthUser.uid);
      setUser(userProfile);
      if (levelUpData) {
        setLevelUpInfo(levelUpData);
      }
    } catch (err) {
      console.error('[USER_CTX] Error fetching user profile:', err);
      setError('Failed to load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    
    if (authUser) {
      fetchUser(authUser);
      const unsubscribe = onSnapshot(doc(db, 'users', authUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          setUser(docSnap.data() as User);
        }
      }, (err) => {
        console.error("[USER_CTX] Snapshot listener error:", err);
        setError("Failed to listen for profile updates.");
      });
      return () => unsubscribe();
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [authUser, authLoading, fetchUser]);
  
  const clearLevelUpInfo = useCallback(() => setLevelUpInfo(null), []);
  
  const reloadUser = useCallback(async () => {
    if (authUser) {
      await fetchUser(authUser);
    }
  }, [authUser, fetchUser]);

  const value: UserContextType = {
    user,
    loading: authLoading || loading,
    error,
    levelUpInfo,
    clearLevelUpInfo,
    reloadUser,
    retryUserFetch: reloadUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
