// src/app/(app)/library/book/page.tsx
"use client";

import LibraryView from "@/features/library/components/LibraryView";

// This page is now a client component and directly renders LibraryView
export default function BookLibraryPage() {
  return <LibraryView contentType="book" />;
}
