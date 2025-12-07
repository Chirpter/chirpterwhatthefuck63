// app/(app)/layout.tsx 

'use client';

import React from 'react';
import AppLayoutContent from '@/components/layout/AppLayoutContent';
import { useSessionVerification } from '@/hooks/useSessionVerification';

export default function ProtectedAppLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  // 🔥 CRITICAL: This hook monitors session validity
  // Without this, users won't be logged out when session expires
  useSessionVerification();
  
  return (
    <AppLayoutContent>
      {children}
    </AppLayoutContent>
  );
}
