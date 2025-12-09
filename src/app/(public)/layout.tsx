import React from 'react';

// This layout ensures that all public pages receive the global providers
// from the root layout at src/app/layout.tsx.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
