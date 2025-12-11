// src/contexts/user-context.tsx - PERFORMANCE OPTIMIZED
"use client";

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
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
  
  const fetchStateRef = useRef({
    inProgress: false,
    currentUserId: null as string | null,
  });
  
  const cleanupRef = useRef<(() => void) | null>(null);

  // ✅ OPTIMIZED: Removed retry logic, fail fast
  const fetchUser = useCallback(async (firebaseUser: FirebaseUser) => {
    const state = fetchStateRef.current;
    
    if (state.inProgress && state.currentUserId === firebaseUser.uid) {
      return;
    }

    state.inProgress = true;
    state.currentUserId = firebaseUser.uid;
    setLoading(true);
    setError(null);
    
    try {
      const { user: userProfile, leveledUpInfo: levelUpData } = await createOrFetchUserProfile(firebaseUser.uid);
      
      if (state.currentUserId === firebaseUser.uid) {
        setUser(userProfile);
        if (levelUpData) {
          setLevelUpInfo(levelUpData);
        }
      }
    } catch (err) {
      console.error('[USER_CTX] Error fetching user:', err);
      setError('Failed to load profile. Please refresh.');
    } finally {
      setLoading(false);
      state.inProgress = false;
    }
  }, []);

  useEffect(() => {
    const state = fetchStateRef.current;
    
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    
    if (authLoading) {
      return;
    }
    
    if (authUser) {
      if (state.currentUserId !== authUser.uid) {
        fetchUser(authUser);
      }
      
      // ✅ OPTIMIZED: Snapshot listener with error handling
      const unsubscribe = onSnapshot(
        doc(db, 'users', authUser.uid), 
        {
          next: (docSnap) => {
            if (docSnap.exists() && state.currentUserId === authUser.uid) {
              const userData = docSnap.data() as User;
              
              setUser(prevUser => {
                if (!prevUser) return userData;
                
                // Simple shallow comparison
                if (JSON.stringify(prevUser) === JSON.stringify(userData)) {
                  return prevUser;
                }
                
                return userData;
              });
            }
          },
          error: (err) => {
            console.error("[USER_CTX] Snapshot error:", err);
          }
        }
      );
      
      cleanupRef.current = unsubscribe;
      
      return () => {
        unsubscribe();
        cleanupRef.current = null;
      };
      
    } else {
      setUser(null);
      setLoading(false);
      setError(null);
      state.currentUserId = null;
      state.inProgress = false;
    }
  }, [authUser, authLoading, fetchUser]);
  
  const clearLevelUpInfo = useCallback(() => setLevelUpInfo(null), []);
  
  const reloadUser = useCallback(async () => {
    if (authUser) {
      const state = fetchStateRef.current;
      state.currentUserId = null;
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