
'use client';

import LoginView from '@/features/auth/components/LoginView';

// This page component now correctly acts as a simple wrapper.
// All UI logic is handled by the LoginView component, adhering to our architecture.
export default function LoginPage() {
  return <LoginView />;
}
