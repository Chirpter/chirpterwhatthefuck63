// src/app/(app)/library/vocabulary/page.tsx
"use client";

import LibraryView from "@/features/library/components/LibraryView";

// This page is now a client component and directly renders LibraryView
export default function VocabularyLibraryPage() {
  return <LibraryView contentType="vocabulary" />;
}
