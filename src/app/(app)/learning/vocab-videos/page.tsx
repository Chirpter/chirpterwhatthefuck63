
"use client";

import VocabVideosView from '@/features/learning/components/vocab-videos/VocabVideosView';
import { VocabVideosProvider } from '@/features/learning/contexts/VocabVideosContext';

export default function VocabVideosPage() {
  return (
    <VocabVideosProvider>
      <VocabVideosView />
    </VocabVideosProvider>
  );
}
