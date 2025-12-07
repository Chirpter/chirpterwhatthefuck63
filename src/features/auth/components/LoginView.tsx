'use client';

import React, { useEffect, useState, useRef } from 'react';
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

type RedirectState = 'idle' | 'waiting_session' | 'redirecting' | 'blocked';

export default function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    authUser, 
    isSessionReady,
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
  const [redirectState, setRedirectState] = useState<RedirectState>('idle');
  const hasRedirectedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());

  // 🔥 CRITICAL: Block redirect if user just logged out
  useEffect(() => {
    const reason = searchParams.get('reason');
    
    if (reason === 'logged_out' || reason === 'logout_error') {
      console.log('[LoginView] 🛑 Blocking redirect - user just logged out');
      setRedirectState('blocked');
      hasRedirectedRef.current = true; // Prevent any future redirects
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
        duration: 3000,
      });
      
      return;
    }
    
    // Show appropriate messages for other reasons
    if (reason === 'session_expired') {
      toast({
        title: "Session Expired",
        description: "Please log in again.",
        variant: "destructive",
        duration: 4000,
      });
    } else if (reason === 'invalid_session') {
      toast({
        title: "Session Invalid",
        description: "Please log in again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  }, [searchParams, toast]);

  // Normal redirect logic (only if not blocked)
  useEffect(() => {
    // Don't redirect if already redirected or blocked
    if (hasRedirectedRef.current || redirectState === 'blocked') {
      return;
    }

    // Don't redirect if no authenticated user
    if (!authUser || !isSessionReady) {
      return;
    }

    // Safety check: Don't redirect within first 2 seconds of mount
    // This prevents redirect during logout cleanup
    const timeSinceMount = Date.now() - mountTimeRef.current;
    if (timeSinceMount < 2000) {
      console.log('[LoginView] ⏸️  Delaying redirect - component just mounted');
      return;
    }

    console.log('[LoginView] ✅ User authenticated & session ready');
    setRedirectState('redirecting');
    hasRedirectedRef.current = true;
    
    const nextPath = searchParams.get('next') || '/library/book';
    
    const timer = setTimeout(() => {
      console.log('[LoginView] Redirecting to:', nextPath);
      router.replace(nextPath);
    }, 300);

    return () => clearTimeout(timer);
  }, [authUser, isSessionReady, router, searchParams, redirectState]);
  
  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <Logo className="h-12 w-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (authUser && redirectState === 'waiting_session') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <Logo className="h-12 w-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Securing your session...</p>
          <p className="text-xs text-muted-foreground/60 mt-2">This should only take a moment</p>
        </div>
      </div>
    );
  }

  if (authUser && redirectState === 'redirecting') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <Icon name="CheckCircle2" className="h-12 w-12 text-green-500 mx-auto mb-4 animate-bounce" />
          <p className="text-sm font-medium">Success! Redirecting...</p>
        </div>
      </div>
    );
  }

  // 🔥 Show login form (even if authUser exists but redirectState is blocked)
  const handleEmailAuth = async (e: React.FormEvent, email: string, pass: string) => {
    e.preventDefault();
    
    const authOperation = authMode === 'signup' ? signUpWithEmail : signInWithEmail;
    const success = await authOperation(email, pass);
    
    if (success) {
      setRedirectState('waiting_session');
      toast({ 
        title: authMode === 'signup' ? "Account Created!" : "Login Successful", 
        description: "Setting up your session...",
        duration: 2000
      });
    }
  };

  const handleGoogleSignIn = async () => {
    const success = await signInWithGoogle();
    
    if (success) {
      setRedirectState('waiting_session');
      toast({ 
        title: "Login Successful", 
        description: "Setting up your session...",
        duration: 2000
      });
    }
  };

  const toggleAuthMode = () => {
    clearAuthError();
    setAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
  };

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