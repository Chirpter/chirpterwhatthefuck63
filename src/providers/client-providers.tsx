// src/providers/client-providers.tsx
'use client';

import React, { Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { AuthProvider } from '@/providers/auth-provider'; // Updated import
import { UserProvider } from '@/providers/user-provider'; // Updated import
import { SettingsProvider } from '@/contexts/settings-context';
import { BookmarkProvider } from '@/contexts/bookmark-context';
import { AudioPlayerProvider } from '@/contexts/audio-player-context';
import { VocabVideosProvider } from '@/features/learning/contexts/VocabVideosContext';
import { AudioPlayer } from '@/features/player/components/AudioPlayer';
import type { CombinedBookmark } from '@/lib/types';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { PerformanceMonitor } from '@/components/dev/PerformanceMonitor';

// ✅ FIX: Directly import the client-side listener logic
import { initializeAchievementListener, cleanupAchievementListener } from '@/features/vocabulary/listeners/achievement-listener';

/**
 * This is the single entry point for all CLIENT-SIDE providers.
 * It is marked with 'use client' and receives server-fetched data as props.
 */
export const ClientProviders = ({ initialBookmarks, children }: { initialBookmarks: CombinedBookmark[], children: React.ReactNode }) => {
    // This effect initializes and cleans up listeners that need the client environment.
    React.useEffect(() => {
        // ✅ FIX: Call the listener initialization directly here
        initializeAchievementListener();
        return () => {
            cleanupAchievementListener();
        };
    }, []);

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <I18nextProvider i18n={i18n}>
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
            </I18nextProvider>
        </ThemeProvider>
    );
};
