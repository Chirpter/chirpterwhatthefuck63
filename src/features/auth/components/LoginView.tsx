// src/features/auth/components/LoginView.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/useToast';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { Logo } from '@/components/ui/Logo';
import { auth } from '@/lib/firebase';
import { ApiServiceError } from '@/lib/errors';

// Helper to navigate using a full page reload for a clean state.
function navigateTo(path: string) {
    if (typeof window !== 'undefined') {
        window.location.href = path;
    }
}

// Helper to create the session cookie.
async function createSession(idToken: string): Promise<boolean> {
    try {
        const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });
        return response.ok;
    } catch (error) {
        console.error("Failed to create session:", error);
        return false;
    }
}


const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,34.556,44,29.865,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
);

export default function LoginView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { 
    authUser, 
    loading: isAuthLoading, 
    error: authError, 
    isSigningIn,
    signUpWithEmail, 
    signInWithEmail,
    signInWithGoogle,
    clearAuthError,
  } = useAuth();
  const { toast } = useToast();
  
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [hasShownToast, setHasShownToast] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Function to handle the complete auth flow after Firebase sign-in
  const handleAuthSuccess = async () => {
    setIsCreatingSession(true);
    const currentUser = auth.currentUser;
    if (!currentUser) {
        toast({ title: "Authentication Error", description: "User object not found after sign-in.", variant: "destructive" });
        setIsCreatingSession(false);
        return;
    }
    
    const idToken = await currentUser.getIdToken(true);
    const cookieSet = await createSession(idToken);
    
    if (cookieSet) {
        navigateTo('/library/book');
    } else {
        toast({ title: "Session Error", description: "Could not create a secure session. Please try again.", variant: "destructive" });
        setIsCreatingSession(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent, email: string, pass: string) => {
    e.preventDefault();
    const authOperation = authMode === 'signup' ? signUpWithEmail : signInWithEmail;
    const success = await authOperation(email, pass);
    if (success) {
      await handleAuthSuccess();
    }
  };

  const handleGoogleSignIn = async () => {
    const success = await signInWithGoogle();
    if (success) {
      await handleAuthSuccess();
    }
  };

  useEffect(() => {
    if (hasShownToast) return;
    
    const reason = searchParams.get('reason');
    if (reason === 'logged_out') {
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      setHasShownToast(true);
      router.replace('/login', { scroll: false });
    } else if (reason === 'session_expired' || reason === 'session_revoked') {
      toast({ title: "Session Expired", description: "Please log in again.", variant: "destructive" });
      setHasShownToast(true);
      router.replace('/login', { scroll: false });
    }
  }, [searchParams, toast, router, hasShownToast]);
  
  const toggleAuthMode = () => {
    clearAuthError();
    setAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
  };

  if (isAuthLoading || authUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
            <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
            <p className="mt-2 text-body-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const isOverallBusy = isSigningIn || isCreatingSession;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-blue-50 to-blue-100 dark:from-background dark:via-blue-900/20 dark:to-blue-900/30 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center gap-2">
            <Logo className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-headline font-bold text-primary">Chirpter</h1>
          </div>
        </CardHeader>
        <CardContent>
          {authMode === 'signin' ? (
            <>
              <AuthForm 
                isSignUp={false}
                onSubmit={handleEmailAuth}
                isSigningIn={isOverallBusy}
                error={authError}
              />
              <p className="mt-4 text-center text-body-sm">
                Don&apos;t have an account?{' '}
                <button 
                  onClick={toggleAuthMode} 
                  className="font-semibold text-primary hover:underline focus:outline-none"
                  disabled={isOverallBusy}
                >
                  Sign Up
                </button>
              </p>
            </>
          ) : (
            <>
              <AuthForm 
                isSignUp={true}
                onSubmit={handleEmailAuth}
                isSigningIn={isOverallBusy}
                error={authError}
              />
              <p className="mt-4 text-center text-body-sm">
                Already have an account?{' '}
                <button 
                  onClick={toggleAuthMode} 
                  className="font-semibold text-primary hover:underline focus:outline-none"
                  disabled={isOverallBusy}
                >
                  Sign In
                </button>
              </p>
            </>
          )}
        
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={handleGoogleSignIn} 
              className="w-full font-body gap-2" 
              variant="outline" 
              disabled={isOverallBusy}
            >
              {isOverallBusy ? (
                <Icon name="Loader2" className="animate-spin h-4 w-4" />
              ) : (
                <GoogleIcon />
              )}
              Google
            </Button>
          </div>
        </CardContent>
      </Card>

      {isOverallBusy && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-sm mx-4">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center gap-4">
                <Logo className="h-12 w-12 text-primary animate-pulse" />
                <div className="text-center space-y-1">
                  <p className="font-semibold">
                    {isCreatingSession ? "Creating secure session..." : "Signing you in..."}
                  </p>
                  <p className="text-body-sm">{t('toast:pleaseWait')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
