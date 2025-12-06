"use client";

import LibraryView from "@/features/library/components/LibraryView";
import type { LibraryItem } from "@/lib/types";

interface LibraryPageComponentProps {
  contentType: 'book' | 'piece' | 'vocabulary';
}

export default function LibraryPageComponent({ contentType }: LibraryPageComponentProps) {
  // The client-side LibraryView is now responsible for fetching its own data.
  // The initialItems prop has been removed.
  return <LibraryView contentType={contentType} />;
}
