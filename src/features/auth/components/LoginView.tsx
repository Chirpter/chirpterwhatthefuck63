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

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,34.556,44,29.865,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
);

export default function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Display toast messages based on logout reasons from URL, handled by middleware.
  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'logged_out') {
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
        duration: 3000,
      });
    } else if (reason === 'session_expired' || reason === 'session_revoked') {
      toast({
        title: "Session Expired",
        description: "Please log in again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  }, [searchParams, toast]);
  
  // This effect handles the redirection *after* a successful login.
  // It no longer needs to check authUser, it just triggers a reload.
  const handleLoginSuccess = () => {
    console.log("[LoginView] ✅ User authenticated, preparing redirect...");
    toast({ 
      title: authMode === 'signup' ? "Account Created!" : "Login Successful", 
      description: "Redirecting you to the library...",
      duration: 2000
    });
    
    const nextPath = searchParams.get('next') || '/library/book';
    console.log(`[LoginView] Redirecting to ${nextPath}...`);
    // A hard reload is the simplest way to ensure the new session cookie is sent
    // to the middleware for all subsequent requests.
    window.location.href = nextPath;
  };

  const handleEmailAuth = async (e: React.FormEvent, email: string, pass: string) => {
    e.preventDefault();
    const authOperation = authMode === 'signup' ? signUpWithEmail : signInWithEmail;
    const success = await authOperation(email, pass);
    if (success) {
      handleLoginSuccess();
    }
  };

  const handleGoogleSignIn = async () => {
    const success = await signInWithGoogle();
    if (success) {
      handleLoginSuccess();
    }
  };

  const toggleAuthMode = () => {
    clearAuthError();
    setAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
  };

  // If Firebase is still checking the initial auth state, show a loader.
  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Logo className="h-16 w-16 animate-pulse text-primary" />
      </div>
    );
  }

  // The main login UI
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
                isSigningIn={isSigningIn}
                error={authError}
              />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button 
                  onClick={toggleAuthMode} 
                  className="font-semibold text-primary hover:underline focus:outline-none"
                  disabled={isSigningIn}
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
                isSigningIn={isSigningIn}
                error={authError}
              />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button 
                  onClick={toggleAuthMode} 
                  className="font-semibold text-primary hover:underline focus:outline-none"
                  disabled={isSigningIn}
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
              disabled={isSigningIn}
            >
              {isSigningIn ? (
                <Icon name="Loader2" className="animate-spin h-4 w-4" />
              ) : (
                <GoogleIcon />
              )}
              Google
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
