// app/(app)/library/page.tsx

import { redirect } from 'next/navigation';

// 🔥 This is a server component that runs on EVERY navigation
// It should ONLY redirect, no conditions
export default function LibraryRootPage() {
  // Simple, unconditional redirect
  // Middleware will handle auth checks
  redirect('/library/book');
}
