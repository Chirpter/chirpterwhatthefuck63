// src/app/(app)/layout.tsx
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
import { usePathname } from 'next/navigation';

const LevelUpDialog = dynamic(() => import('@/features/user/components/LevelUpDialog'), { ssr: false });
const LanguageSurveyDialog = dynamic(() => import('@/features/user/components/LanguageSurveyDialog'), { ssr: false });

const InitialLoader = ({ message = "Loading..." }: { message?: string }) => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="text-center">
      <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  </div>
);

const UserProfileError = ({ error, onRetry, onLogout }: { 
  error: string; 
  onRetry: () => void; 
  onLogout: () => void; 
}) => (
  <div className="flex h-screen w-full items-center justify-center p-4 bg-background">
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
  const pathname = usePathname();

  // The AppErrorManager is now initialized in the client providers
  // useEffect(() => {
  //   AppErrorManager.initialize();
  // }, []);

  if (isUserLoading) {
    return <InitialLoader message="Loading your profile..." />;
  }

  if (userError && !user) {
    return (
      <UserProfileError 
        error={userError}
        onRetry={retryUserFetch}
        onLogout={logout}
      />
    );
  }
  
  if (!user) {
    return <InitialLoader message="Finalizing session..." />;
  }

  // Special pages that use full viewport (reader pages)
  const isReaderPage = pathname?.startsWith('/read/');

  return (
    <>
      {/* Header - Fixed at top */}
      <AppHeader />
      
      {/* Main Content - Natural flex layout */}
      <main 
        className={cn(
          "bg-background flex-1 flex flex-col",
          isReaderPage 
            ? "" // Reader uses full main height
            : "pt-4 md:pt-6 px-4 sm:px-6 pb-24" // Normal pages get padding
        )}
      >
        {children}
      </main>
      
      {/* Level Up Dialog */}
      <Suspense fallback={null}>
        {levelUpInfo && (
          <LevelUpDialog 
            isOpen={!!levelUpInfo}
            onClose={clearLevelUpInfo}
            levelUpInfo={levelUpInfo}
          />
        )}
      </Suspense>

      {/* Language Survey Dialog for new users */}
      <Suspense fallback={null}>
        {user && !user.hasCompletedLanguageSurvey && (
          <LanguageSurveyDialog />
        )}
      </Suspense>
    </>
  );
};

export default function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const { authUser, loading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <InitialLoader message="Authenticating..." />;
  }

  if (!authUser) {
    return <InitialLoader message="Redirecting to login..." />;
  }

  return <AuthenticatedContent>{children}</AuthenticatedContent>;
}
