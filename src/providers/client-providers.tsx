// src/providers/client-providers.tsx - FIXED VERSION
'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { AuthProvider } from '@/providers/auth-provider';
import { UserProvider } from '@/providers/user-provider';
import { SettingsProvider } from '@/contexts/settings-context';
import { BookmarkProvider } from '@/contexts/bookmark-context';
import { AudioPlayerProvider } from '@/contexts/audio-player-context';
import { VocabVideosProvider } from '@/features/learning/contexts/VocabVideosContext';
import { AudioPlayer } from '@/features/player/components/AudioPlayer';
import type { CombinedBookmark } from '@/lib/types';
import { Toaster } from '@/components/ui/toaster';
import { PerformanceMonitor } from '@/components/dev/PerformanceMonitor';
import { ThemeProvider } from '@/providers/theme-provider';
import { Logo } from '@/components/ui/Logo';

import { initializeAchievementListener, cleanupAchievementListener } from '@/features/vocabulary/listeners/achievement-listener';

/**
 * ✅ FIX: Add a client-only check to prevent hydration mismatches
 */
const InitialLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="text-center">
      <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
      <p className="mt-2 text-sm text-muted-foreground">Initializing...</p>
    </div>
  </div>
);

/**
 * This is the single entry point for all CLIENT-SIDE providers.
 * It is marked with 'use client' and receives server-fetched data as props.
 */
export const ClientProviders = ({ 
  initialBookmarks, 
  children 
}: { 
  initialBookmarks: CombinedBookmark[], 
  children: React.ReactNode 
}) => {
  // ✅ FIX: Ensure we're on the client before mounting providers
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    initializeAchievementListener();
    
    return () => {
      cleanupAchievementListener();
    };
  }, []);

  // ✅ FIX: Show loader during initial mount to prevent hydration mismatch
  if (!isMounted) {
    return <InitialLoader />;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <UserProvider>
            <SettingsProvider>
              <BookmarkProvider initialBookmarks={initialBookmarks}>
                <AudioPlayerProvider>
                  <VocabVideosProvider>
                    {children}
                    <Suspense fallback={null}>
                      <AudioPlayer />
                    </Suspense>
                    <Toaster />
                    {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
                  </VocabVideosProvider>
                </AudioPlayerProvider>
              </BookmarkProvider>
            </SettingsProvider>
          </UserProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
};
