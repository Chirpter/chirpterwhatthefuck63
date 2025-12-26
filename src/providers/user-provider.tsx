// src/providers/user-provider.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import type { User } from '@/lib/types';
import { UserContext, type UserContextType, type LevelUpInfo } from '@/contexts/user-context';
import { ApiServiceError } from '@/lib/errors';

// Helper to make server action call
async function createOrFetchUser(uid: string): Promise<{ user: User, leveledUpInfo: LevelUpInfo | null }> {
    const { createOrFetchUserProfile } = await import('@/services/server/user-service');
    return createOrFetchUserProfile(uid);
}


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
      // ✅ REVERT: Call server action directly.
      const { user: userProfile, leveledUpInfo } = await createOrFetchUser(firebaseUser.uid);
      
      if (state.currentUserId === firebaseUser.uid) {
        setUser(userProfile);
        if (leveledUpInfo) {
          setLevelUpInfo(leveledUpInfo);
        }
      }
    } catch (err: any) {
      console.error('[USER_CTX] Error fetching user:', err);
      // ✅ ENHANCED ERROR HANDLING: Show specific message for ApiServiceError
      if (err instanceof ApiServiceError) {
        setError(err.message);
      } else {
        setError('Failed to load profile. Please refresh.');
      }
    } finally {
      if (state.currentUserId === firebaseUser.uid) {
        setLoading(false);
        state.inProgress = false;
      }
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
      
      const unsubscribe = onSnapshot(
        doc(db, 'users', authUser.uid), 
        (docSnap) => {
          if (docSnap.exists() && fetchStateRef.current.currentUserId === authUser.uid) {
            const userData = docSnap.data() as User;
            setUser(prevUser => {
                if (!prevUser) return userData;
                // Simple string comparison to prevent re-renders if data is identical
                if (JSON.stringify(prevUser) === JSON.stringify(userData)) {
                    return prevUser;
                }
                return userData;
            });
          }
        },
        (err) => {
          console.error("[USER_CTX] Snapshot listener error:", err);
          setError("Connection to profile updates failed.");
        }
      );
      
      cleanupRef.current = unsubscribe;
      
    } else {
      setUser(null);
      setLoading(false);
      setError(null);
      state.currentUserId = null;
      state.inProgress = false;
    }
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [authUser, authLoading, fetchUser]);
  
  const clearLevelUpInfo = useCallback(() => setLevelUpInfo(null), []);
  
  const reloadUser = useCallback(async () => {
    if (authUser) {
      fetchStateRef.current.currentUserId = null; // Force refetch
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
