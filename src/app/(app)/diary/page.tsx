
'use client';

import dynamic from 'next/dynamic';
import { Icon } from '@/components/ui/icons';

const DiaryViewLoader = () => (
    <div className="flex h-screen w-full items-center justify-center bg-background">
        <Icon name="BookOpen" className="h-12 w-12 animate-pulse text-primary" />
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
