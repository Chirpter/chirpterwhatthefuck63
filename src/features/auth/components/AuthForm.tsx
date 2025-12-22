// src/features/auth/components/AuthForm.tsx

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icons';

interface AuthFormProps {
    isSignUp: boolean;
    onSubmit: (e: React.FormEvent, email: string, pass: string) => void;
    isSigningIn: boolean;
    error: string | null;
}

const validateEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const AuthForm: React.FC<AuthFormProps> = ({ isSignUp, onSubmit, isSigningIn, error }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [localError, setLocalError] = useState('');

    const isEmailValid = useMemo(() => validateEmail(email), [email]);
    const isPasswordValid = useMemo(() => password.length >= 6, [password]);
    const isConfirmPasswordValid = useMemo(() => !isSignUp || password === confirmPassword, [isSignUp, password, confirmPassword]);

    const canSubmit = useMemo(() => 
        isEmailValid && isPasswordValid && isConfirmPasswordValid && !isSigningIn,
        [isEmailValid, isPasswordValid, isConfirmPasswordValid, isSigningIn]
    );
    
    // Clear local errors when the main error from the context changes
    useEffect(() => {
        if (error) {
            setLocalError('');
        }
    }, [error]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');
        
        if (!isEmailValid) {
            setLocalError('Please enter a valid email address.');
            return;
        }
        if (!isPasswordValid) {
            setLocalError('Password must be at least 6 characters long.');
            return;
        }
        if (!isConfirmPasswordValid) {
            setLocalError("Passwords do not match.");
            return;
        }
        
        if (!canSubmit) return;

        onSubmit(e, email, password);
    };

    const displayError = localError || error;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor={isSignUp ? "signup-email" : "signin-email"}>Email</Label>
                <Input id={isSignUp ? "signup-email" : "signin-email"} type="email" placeholder="you@example.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={isSigningIn} autoComplete="email" />
            </div>
            <div className="space-y-2">
                <Label htmlFor={isSignUp ? "signup-password" : "signin-password"}>Password</Label>
                <Input id={isSignUp ? "signup-password" : "signin-password"} type="password" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} disabled={isSigningIn} autoComplete={isSignUp ? "new-password" : "current-password"} />
            </div>
            {isSignUp && (
                 <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input id="confirm-password" type="password" placeholder="••••••••" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isSigningIn} autoComplete="new-password" />
                </div>
            )}
            {displayError && <p className="text-caption text-destructive text-center">{displayError}</p>}
            <Button 
              type="submit" 
              className="w-full text-sm" 
              disabled={!canSubmit}
            >
                {isSigningIn ? <Icon name="Loader2" className="animate-spin mr-2 h-4 w-4" /> : null}
                {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
        </form>
    );
};
