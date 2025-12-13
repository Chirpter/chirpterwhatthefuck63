
'use client';

import dynamic from 'next/dynamic';
import { Logo } from '@/components/ui/Logo';

// ✅ UPDATED: The loader now uses the standardized InitialLoader style with the Logo.
const DiaryViewLoader = () => (
    <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
            <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">Loading Diary...</p>
        </div>
    </div>
);

// Use dynamic import to lazy-load the entire Diary feature.
// This ensures that none of the heavy canvas logic is included in the initial
// JavaScript bundle for other parts of the application, like the library.
const DiaryView = dynamic(() => import('@/features/diary/components/DiaryView'), {
  ssr: false, // Diary is a client-only feature and doesn't need server-side rendering.
  loading: () => <DiaryViewLoader />,
});

export default function DiaryPage() {
  return <DiaryView />;
}
