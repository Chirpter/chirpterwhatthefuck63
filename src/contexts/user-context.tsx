// src/contexts/user-context.tsx - CẢI TIẾN
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
  
  // ✅ FIX: Track fetch to prevent duplicate calls
  const fetchInProgress = useRef(false);
  const currentUserId = useRef<string | null>(null);

  const fetchUser = useCallback(async (firebaseUser: FirebaseUser) => {
    // ✅ Prevent duplicate fetches
    if (fetchInProgress.current || currentUserId.current === firebaseUser.uid) {
      return;
    }

    fetchInProgress.current = true;
    currentUserId.current = firebaseUser.uid;
    setLoading(true);
    setError(null);
    
    try {
      const { user: userProfile, leveledUpInfo: levelUpData } = await createOrFetchUserProfile(firebaseUser.uid);
      setUser(userProfile);
      if (levelUpData) {
        setLevelUpInfo(levelUpData);
      }
    } catch (err) {
      console.error('[USER_CTX] Error fetching user profile:', err);
      setError('Failed to load your profile. Please try again.');
      currentUserId.current = null; // Allow retry
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    // ✅ Don't do anything while auth is loading
    if (authLoading) return;
    
    if (authUser) {
      // ✅ Only fetch if we haven't already for this user
      if (currentUserId.current !== authUser.uid) {
        fetchUser(authUser);
      }
      
      // ✅ Set up real-time listener
      const unsubscribe = onSnapshot(
        doc(db, 'users', authUser.uid), 
        (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            // ✅ FIX: Only update if data actually changed
            setUser(prevUser => {
              if (JSON.stringify(prevUser) === JSON.stringify(userData)) {
                return prevUser; // Prevent unnecessary re-renders
              }
              return userData;
            });
          }
        }, 
        (err) => {
          console.error("[USER_CTX] Snapshot listener error:", err);
          setError("Failed to listen for profile updates.");
        }
      );
      
      return () => unsubscribe();
    } else {
      // ✅ User logged out - clear state
      setUser(null);
      setLoading(false);
      currentUserId.current = null;
      fetchInProgress.current = false;
    }
  }, [authUser, authLoading, fetchUser]);
  
  const clearLevelUpInfo = useCallback(() => setLevelUpInfo(null), []);
  
  const reloadUser = useCallback(async () => {
    if (authUser) {
      // ✅ Force reload by clearing current user ID
      currentUserId.current = null;
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