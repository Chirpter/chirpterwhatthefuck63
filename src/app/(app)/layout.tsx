// src/app/(app)/layout.tsx
'use client';

import React from 'react';
import AppLayoutContent from '@/components/layout/AppLayoutContent';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';

export default function ProtectedAppLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { authUser, loading } = useAuth();
  const router = useRouter();

  // Middleware is now the primary gatekeeper. This useEffect is a client-side
  // safeguard. If for some reason the auth state is lost while the user is actively
  // using the app (e.g., token revoked on another device), it will redirect.
  React.useEffect(() => {
    if (!loading && !authUser) {
      router.replace('/login');
    }
  }, [loading, authUser, router]);
  
  // While loading, show a full-screen loader to prevent content flashing.
  // This is important as the middleware has already allowed access, but the client
  // might still be resolving the auth state.
  if (loading || !authUser) {
    return (
       <div className="flex h-screen w-full items-center justify-center bg-background">
          <Logo className="h-24 w-24 animate-pulse text-primary" />
        </div>
    );
  }

  // Once authenticated on the client, render the main app layout.
  return (
    <AppLayoutContent>
      {children}
    </AppLayoutContent>
  );
}
