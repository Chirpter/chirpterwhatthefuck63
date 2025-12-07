// src/app/(app)/layout.tsx
'use client';

import React from 'react';
import AppLayoutContent from '@/components/layout/AppLayoutContent';
import { useAuth } from '@/contexts/auth-context';
import { Logo } from '@/components/ui/Logo';

export default function ProtectedAppLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { authUser, loading } = useAuth();

  // While the initial auth state is being resolved by Firebase on the client,
  // show a full-screen loader. The middleware has already ensured that the user
  // is authenticated on the server side, so this prevents any "flash" of content.
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
