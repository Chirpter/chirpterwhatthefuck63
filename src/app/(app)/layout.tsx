

import React from 'react';
import AppLayoutContent from '@/components/layout/AppLayoutContent';

export default function ProtectedAppLayout({ children }: { children: React.ReactNode; }) {
  // This layout is the main wrapper for the authenticated part of the app.
  // AppLayoutContent handles both the auth check and the rendering of the UI.
  // A Suspense boundary is not needed here as loading states are managed within AppLayoutContent.
  return (
    <AppLayoutContent>
        {children}
    </AppLayoutContent>
  );
}
