// src/components/layout/AppLayoutContent.tsx

"use client";

import React, { useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/contexts/user-context';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import AppHeader from './AppHeader';
import { Logo } from '../ui/Logo';
import { AppErrorManager } from '@/services/error-manager';

// Lazy load the LevelUpDialog as it's not always needed
const LevelUpDialog = dynamic(() => import('@/features/user/components/LevelUpDialog'), { ssr: false });

// A simple loader component
const InitialLoader = ({ message = "Loading..." }: { message?: string }) => (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center">
          <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
);

// A component to show when user profile fails to load
const UserProfileError = ({ error, onRetry, onLogout }: { 
  error: string; 
  onRetry: () => void; 
  onLogout: () => void; 
}) => (
  <div className="flex h-full w-full items-center justify-center p-4">
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

export default function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { authUser, loading: isAuthLoading, logout } = useAuth();
  const { 
    user, 
    loading: isUserLoading, 
    error: userError, 
    levelUpInfo, 
    clearLevelUpInfo,
    retryUserFetch
  } = useUser();

  // Initialize global error manager once
  useEffect(() => {
    AppErrorManager.initialize();
  }, []);
  
  if (isAuthLoading) {
    return <InitialLoader message="Authenticating..." />;
  }

  if (!authUser) {
     // This case should theoretically not be hit often because the middleware redirects.
     // However, it's a good safeguard during the logout transition.
     return <InitialLoader message="Redirecting..." />;
  }
  
  if (isUserLoading) {
    return <InitialLoader message="Loading your profile..." />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />

      <main className={cn(
        "flex-1 bg-background relative", 
        // Add safe area padding for mobile devices, especially on the bottom.
        "px-4 sm:px-6 pt-2 sm:pt-3 pb-24"
      )}>
        {userError && !user ? (
            <UserProfileError 
              error={userError}
              onRetry={retryUserFetch}
              onLogout={logout}
            />
        ) : !user ? (
             <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                  <Icon name="Loader2" className="h-10 w-10 animate-spin text-primary mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">Finalizing your profile...</p>
                </div>
            </div>
        ) : (
          children
        )}
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
}
