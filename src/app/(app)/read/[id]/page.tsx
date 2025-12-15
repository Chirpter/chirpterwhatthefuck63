
// src/app/(app)/read/[id]/page.tsx
import React from 'react';
import { notFound } from 'next/navigation';
import { getLibraryItemById } from '@/services/server/library.service';
import { getUserIdFromSession } from '@/services/server/user-service-helpers'; // Assuming this helper exists
import BookReader from '@/features/reader/components/book/BookReader';
import PieceReader from '@/features/reader/components/piece/PieceReader';

interface ReadPageProps {
  params: { id: string };
}

// This is now the server-side dispatcher component
export default async function ReadPage({ params }: ReadPageProps) {
  const { id } = params;
  let userId: string;

  try {
    userId = await getUserIdFromSession();
  } catch (error) {
    // If no session, redirect or show an error, for now we can redirect in middleware
    // but a hard navigation stop is here as a safeguard.
    return notFound();
  }

  const item = await getLibraryItemById(userId, id);

  if (!item) {
    return notFound();
  }

  // Based on the item type, render the correct reader component.
  if (item.type === 'book') {
    return <BookReader book={item} />;
  }

  if (item.type === 'piece') {
    return <PieceReader piece={item} />;
  }

  // Fallback for any other type (though currently there are none)
  return notFound();
}
