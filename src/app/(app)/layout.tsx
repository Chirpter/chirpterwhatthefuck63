// src/app/(app)/layout.tsx
'use client';

import React from 'react';
import AppLayoutContent from '@/components/layout/AppLayoutContent';

export default function ProtectedAppLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  // AppLayoutContent now handles all auth checks, loading states, and provider setup.
  // This layout simply acts as a wrapper to pass the children down.
  return (
    <AppLayoutContent>
      {children}
    </AppLayoutContent>
  );
}