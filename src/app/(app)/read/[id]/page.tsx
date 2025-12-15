
// src/app/(app)/read/[id]/page.tsx
import React from 'react';
import { notFound } from 'next/navigation';
import { getLibraryItemById } from '@/services/server/library.service';
import BookReader from '@/features/reader/components/book/BookReader';
import PieceReader from '@/features/reader/components/piece/PieceReader';
import { getUserIdFromSession } from '@/services/server/user-service-helpers'; 

interface ReadPageProps {
  params: { id: string };
}

// This is now the server-side dispatcher component
export default async function ReadPage({ params }: ReadPageProps) {
  const { id } = params;
  let userId: string;

  try {
    // We still need to get the user ID on the server to fetch the correct item.
    // The middleware should have already protected this route, so this call is expected to succeed.
    userId = await getUserIdFromSession();
  } catch (error) {
    // If getting the user ID fails here, it implies a more serious session issue.
    // In this case, a 404 is an acceptable fallback as the content is inaccessible.
    console.error("ReadPage: Could not get user from session.", error);
    return notFound();
  }

  // Fetch the item on the server.
  const item = await getLibraryItemById(userId, id);

  if (!item) {
    return notFound();
  }

  // Based on the item type, render the correct reader component,
  // passing the server-fetched data as a prop.
  if (item.type === 'book') {
    return <BookReader book={item} />;
  }

  if (item.type === 'piece') {
    return <PieceReader piece={item} />;
  }

  // Fallback for any other type (though currently there are none)
  return notFound();
}
