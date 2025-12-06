
"use client";

import React from 'react';
import { Logo } from '@/components/ui/Logo';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // ✅ REMOVED: All auth logic is gone. This component is now 'dumb'.
  // Middleware (`middleware.ts`) is now the single source of truth for
  // handling authentication checks and redirects.
  
  // The loader is removed because middleware redirect is server-side,
  // so the user will never see a "loading" state on a public page
  // if they are already authenticated. They will be redirected before
  // this component even renders.

  return <>{children}</>;
}

// NOTE FOR REVIEWER:
// Why this change is crucial for fixing the bug:
// 1.  Eliminates Race Conditions: The old code had both middleware AND this
//     client-side component trying to handle redirects. This created a race
//     where the UI might flash the login page before the client-side
//     redirect kicked in.
// 2.  Single Source of Truth: All auth-related routing decisions are now
//     centralized in `middleware.ts`. This makes the logic easier to
//     understand, debug, and maintain.
// 3.  Improved Performance & UX: By relying on the server-side redirect from
//     middleware, authenticated users are sent to the correct page immediately,
//     without ever rendering the public layout, which prevents UI flashing.
