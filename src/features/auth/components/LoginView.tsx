
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/useToast';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { Logo } from '@/components/ui/Logo';
import { logAuthEvent } from '@/lib/analytics';
import { checkRateLimit, recordFailedAttempt, clearFailedAttempts } from '@/lib/rate-limit';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,34.556,44,29.865,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
);

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function LoginView() {
  const router = useRouter();
  const { authUser, loading, signUpWithEmail, signInWithEmail } = useAuth();
  const { toast } = useToast();
  
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    let isMounted = true;
    
    if (!loading && authUser && isMounted) {
      router.replace('/library/book');
    }
    
    return () => { isMounted = false; };
  }, [authUser, loading, router]);

  if (loading || authUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Logo className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  const handleAuthError = (err: any) => {
    // This logic is now cleaner as it only needs to handle auth-provider level errors
    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        setError('Invalid email or password. Please try again.');
        logAuthEvent('login_failed', { reason: 'invalid_credentials' });
        break;
      case 'auth/email-already-in-use':
        setError('This email address is already registered. Please sign in.');
        break;
      case 'auth/weak-password':
        setError('Password should be at least 6 characters long.');
        break;
      case 'auth/invalid-email':
        setError('Please enter a valid email address.');
        break;
      case 'auth/too-many-requests':
        setError('Too many failed attempts. Please try again later.');
        logAuthEvent('rate_limit_hit', { reason: 'too_many_requests' });
        break;
      default:
        // Generic error for session failures or other unexpected issues from the context
        setError(err.message || 'An unexpected error occurred. Please try again.');
        console.error("Authentication Error:", err);
        logAuthEvent('auth_error', { error: err.code || err.message || 'unknown' });
    }
  };

  const handleEmailAuth = async (e: React.FormEvent, email: string, pass: string) => {
    e.preventDefault();
    
    const rateLimitCheck = checkRateLimit(email);
    if (!rateLimitCheck.allowed) {
      setError(`Too many failed attempts. Please try again in ${Math.ceil(rateLimitCheck.waitTime / 60)} minutes.`);
      return;
    }
    
    setIsSigningIn(true);
    setError('');
    
    try {
      const authOperation = authMode === 'signup' ? signUpWithEmail : signInWithEmail;
      
      await authOperation(email, pass);
      
      clearFailedAttempts(email);
      
      toast({ 
        title: authMode === 'signup' ? "Account Created!" : "Login Successful", 
        description: authMode === 'signup' ? "Welcome! You're now signed in." : "Welcome back!" 
      });
      // The useEffect above will handle the redirection.
    } catch (err: any) {
      recordFailedAttempt(email);
      handleAuthError(err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError('');
    
    try {
      // NOTE: For a complete implementation, a `signInWithGoogle` function should be
      // created in `auth-context` that handles the popup and the session cookie creation.
      // The current implementation is a placeholder.
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      logAuthEvent('login', { method: 'google' });
      toast({ title: "Login Successful", description: "Welcome!" });
      
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (error.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups and try again.');
      } else {
        setError('Could not sign in with Google. Please try again.');
      }
      
      console.error("Google sign-in error:", error);
      logAuthEvent('login_failed', { method: 'google', reason: error.code || 'unknown' });
      
    } finally {
      setIsSigningIn(false);
    }
  };

  const toggleAuthMode = () => {
    setError('');
    setAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-blue-50 to-blue-100 dark:from-background dark:via-blue-900/20 dark:via-blue-900/30 p-4">
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
                onSubmit={(e, email, pass) => handleEmailAuth(e, email, pass)}
                isSigningIn={isSigningIn}
                error={error}
              />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button onClick={toggleAuthMode} className="font-semibold text-primary hover:underline focus:outline-none">
                  Sign Up
                </button>
              </p>
            </>
          ) : (
            <>
              <AuthForm 
                isSignUp={true}
                onSubmit={(e, email, pass) => handleEmailAuth(e, email, pass)}
                isSigningIn={isSigningIn}
                error={error}
              />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button onClick={toggleAuthMode} className="font-semibold text-primary hover:underline focus:outline-none">
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
