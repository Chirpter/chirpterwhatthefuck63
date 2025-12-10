// src/contexts/user-context.tsx - FIXED VERSION
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
  
  // ✅ FIXED: More robust tracking with stable reference
  const fetchStateRef = useRef({
    inProgress: false,
    currentUserId: null as string | null,
    retryCount: 0,
    maxRetries: 3,
  });
  
  // ✅ FIXED: Stable cleanup function
  const cleanupRef = useRef<(() => void) | null>(null);

  const fetchUser = useCallback(async (firebaseUser: FirebaseUser) => {
    const state = fetchStateRef.current;
    
    // ✅ Prevent duplicate fetches for same user
    if (state.inProgress && state.currentUserId === firebaseUser.uid) {
      console.log('[USER_CTX] Fetch already in progress for this user, skipping');
      return;
    }

    state.inProgress = true;
    state.currentUserId = firebaseUser.uid;
    setLoading(true);
    setError(null);
    
    try {
      const { user: userProfile, leveledUpInfo: levelUpData } = await createOrFetchUserProfile(firebaseUser.uid);
      
      // ✅ Only update if still relevant (user hasn't logged out)
      if (state.currentUserId === firebaseUser.uid) {
        setUser(userProfile);
        if (levelUpData) {
          setLevelUpInfo(levelUpData);
        }
        state.retryCount = 0; // Reset on success
      }
    } catch (err) {
      console.error('[USER_CTX] Error fetching user profile:', err);
      
      // ✅ Implement retry logic
      if (state.retryCount < state.maxRetries) {
        state.retryCount++;
        console.log(`[USER_CTX] Retrying fetch (${state.retryCount}/${state.maxRetries})...`);
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * state.retryCount));
        
        // Only retry if user is still the same
        if (state.currentUserId === firebaseUser.uid) {
          state.inProgress = false;
          return fetchUser(firebaseUser);
        }
      } else {
        setError('Failed to load your profile. Please try again.');
        state.currentUserId = null; // Allow retry
      }
    } finally {
      setLoading(false);
      state.inProgress = false;
    }
  }, []);

  useEffect(() => {
    const state = fetchStateRef.current;
    
    // ✅ Cleanup previous listener
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('[USER_CTX] Waiting for auth to load...');
      return;
    }
    
    if (authUser) {
      console.log('[USER_CTX] Auth user detected:', authUser.uid);
      
      // Fetch user profile if needed
      if (state.currentUserId !== authUser.uid) {
        fetchUser(authUser);
      }
      
      // ✅ Set up real-time listener with proper cleanup
      const unsubscribe = onSnapshot(
        doc(db, 'users', authUser.uid), 
        {
          next: (docSnap) => {
            if (docSnap.exists() && state.currentUserId === authUser.uid) {
              const userData = docSnap.data() as User;
              
              // ✅ Deep comparison to prevent unnecessary updates
              setUser(prevUser => {
                if (!prevUser) return userData;
                
                const hasChanged = JSON.stringify(prevUser) !== JSON.stringify(userData);
                if (!hasChanged) {
                  return prevUser;
                }
                
                console.log('[USER_CTX] User data updated from snapshot');
                return userData;
              });
            }
          },
          error: (err) => {
            console.error("[USER_CTX] Snapshot listener error:", err);
            // Don't set error state for listener failures - data might still be valid
          }
        }
      );
      
      cleanupRef.current = unsubscribe;
      
      // Cleanup on unmount
      return () => {
        unsubscribe();
        cleanupRef.current = null;
      };
      
    } else {
      // ✅ User logged out - clear all state
      console.log('[USER_CTX] No auth user, clearing state');
      setUser(null);
      setLoading(false);
      setError(null);
      state.currentUserId = null;
      state.inProgress = false;
      state.retryCount = 0;
    }
  }, [authUser, authLoading, fetchUser]);
  
  const clearLevelUpInfo = useCallback(() => setLevelUpInfo(null), []);
  
  const reloadUser = useCallback(async () => {
    if (authUser) {
      const state = fetchStateRef.current;
      // Force reload by clearing current user ID
      state.currentUserId = null;
      state.retryCount = 0;
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