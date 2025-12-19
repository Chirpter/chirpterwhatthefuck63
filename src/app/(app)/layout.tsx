// src/app/(app)/layout.tsx - REFACTORED
'use client';

import React, { useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/contexts/user-context';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/layout/AppHeader';
import { Logo } from '@/components/ui/Logo';
import { AppErrorManager } from '@/services/client/error-manager.service';
import { usePathname } from 'next/navigation'; // Import usePathname

// --- Reusable Components ---

const LevelUpDialog = dynamic(() => import('@/features/user/components/LevelUpDialog'), { ssr: false });

const InitialLoader = ({ message = "Loading..." }: { message?: string }) => (
    <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
      <div className="text-center">
          <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
);

const UserProfileError = ({ error, onRetry, onLogout }: { 
  error: string; 
  onRetry: () => void; 
  onLogout: () => void; 
}) => (
  <div className="flex h-full w-full items-center justify-center p-4 bg-background text-foreground">
    <div className="text-center max-w-md mx-auto">
      <Icon name="AlertCircle" className="h-16 w-16 text-destructive mx-auto mb-4" />
      <h2 className="text-xl font-semibold mb-2">Unable to Load Profile</h2>
      <p className="text-muted-foreground mb-6">{error}</p>
      <div className="space-y-3">
        <Button onClick={onRetry} className="w-full">
          <Icon name="RotateCw" className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button onClick={onLogout} variant="outline" className="w-full">
          <Icon name="LogOut" className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  </div>
);

const AuthenticatedContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { 
        user, 
        loading: isUserLoading, 
        error: userError, 
        levelUpInfo, 
        clearLevelUpInfo,
        retryUserFetch
    } = useUser();
    const { logout } = useAuth();
    const pathname = usePathname(); // Get current path

    useEffect(() => {
        AppErrorManager.initialize();
    }, []);

    // State 1: User data is loading
    if (isUserLoading) {
        return <InitialLoader message="Loading your profile..." />;
    }

    // State 2: User data failed to load
    if (userError && !user) {
        return (
            <UserProfileError 
                error={userError}
                onRetry={retryUserFetch}
                onLogout={logout}
            />
        );
    }
    
    // State 3: User object is still null after loading (edge case)
    if (!user) {
        return <InitialLoader message="Finalizing session..." />;
    }

    // ✅ CONDITIONAL PADDING: Only add padding if it's NOT the create page
    const isCreatePage = pathname === '/create';

    // State 4: Success - render the main app content
    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className={cn(
                "flex-1 bg-background relative",
                // ✅ Apply padding conditionally
                !isCreatePage && "px-4 sm:px-6 pt-2 sm:pt-3 pb-24"
            )}>
                {children}
            </main>
            <Suspense fallback={null}>
                {levelUpInfo && (
                    <LevelUpDialog 
                        isOpen={!!levelUpInfo}
                        onClose={clearLevelUpInfo}
                        levelUpInfo={levelUpInfo}
                    />
                )}
            </Suspense>
        </div>
    );
};

// --- Main Layout Component ---

export default function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const { authUser, loading: isAuthLoading } = useAuth();

  // State 1: Firebase Auth is still initializing
  if (isAuthLoading) {
    return <InitialLoader message="Authenticating..." />;
  }

  // State 2: No authenticated user, redirect is imminent
  if (!authUser) {
     return <InitialLoader message="Redirecting to login..." />;
  }

  // State 3: Authenticated, render the main content which handles user profile loading
  return <AuthenticatedContent>{children}</AuthenticatedContent>;
}