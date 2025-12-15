// src/app/(app)/library/piece/page.tsx
"use client";

import LibraryView from "@/features/library/components/LibraryView";

// This page is now a client component and directly renders LibraryView
export default function PieceLibraryPage() {
  return <LibraryView contentType="piece" />;
}
