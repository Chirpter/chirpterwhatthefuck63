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

// DO NOT import client-only modules at the top level.
// They will be imported dynamically inside useEffect.

const InitialLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="text-center">
      <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
      <p className="mt-2 text-sm text-muted-foreground">Initializing...</p>
    </div>
  </div>
);

export const ClientProviders = ({ 
  initialBookmarks, 
  children 
}: { 
  initialBookmarks: CombinedBookmark[], 
  children: React.ReactNode 
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // ✅ FIX: Dynamically import and initialize client-side listeners inside useEffect.
    // This ensures they only run in the browser, not on the server.
    const initializeListeners = async () => {
      try {
        const { initializeAchievementListener, cleanupAchievementListener } = await import('@/features/vocabulary/listeners/achievement-listener');
        initializeAchievementListener();
        
        // Return the cleanup function to be run on component unmount.
        return () => {
          cleanupAchievementListener();
        };
      } catch (error) {
        console.error("Failed to initialize client-side listeners:", error);
        return () => {}; // Return an empty cleanup function on error.
      }
    };
    
    let cleanup: (() => void) | undefined;
    
    initializeListeners().then(cleanupFn => {
        cleanup = cleanupFn;
    });

    return () => {
      cleanup?.();
    };
  }, []);

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
                    {/* The PerformanceMonitor is now disabled for production builds */}
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
