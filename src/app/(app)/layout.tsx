// src/app/(app)/layout.tsx
'use client';

import React from 'react';
import AppLayoutContent from '@/components/layout/AppLayoutContent';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

export default function ProtectedAppLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { authUser, loading } = useAuth();
  const router = useRouter();

  // This effect handles the case where a user's auth state is lost while they are in the app.
  // The middleware handles the initial load, but this handles client-side transitions.
  React.useEffect(() => {
    if (!loading && !authUser) {
      router.replace('/login');
    }
  }, [loading, authUser, router]);
  
  // While loading, we might show a loader or null to prevent content flashing
  if (loading || !authUser) {
    return null; // Or a full-screen loader
  }

  // Once authenticated, render the main app layout
  return (
    <AppLayoutContent>
      {children}
    </AppLayoutContent>
  );
}
