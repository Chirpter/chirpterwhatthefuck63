// src/app/(app)/read/[id]/page.tsx - FINAL VERSION
import { notFound } from 'next/navigation';
import { getUserIdFromSession } from '@/services/server/user-service-helpers';
import { getLibraryItemById } from '@/services/server/library-service'; // ✅ Use existing service
import BookReader from '@/features/reader/components/book/BookReader';
import PieceReader from '@/features/reader/components/piece/PieceReader';

interface ReadPageProps {
  params: Promise<{ id: string }>; // ✅ Next.js 15: params is now a Promise
}

/**
 * Read Page - Server Component
 * Fetches library item server-side for better performance and security.
 */
export default async function ReadPage({ params }: ReadPageProps) {
  // ✅ Next.js 15: Await params
  const { id } = await params;
  
  try {
    // ✅ Get userId from session cookie (server-side, already handled by middleware)
    const userId = await getUserIdFromSession();
    
    // ✅ Fetch the item using existing server service
    const item = await getLibraryItemById(userId, id);
    
    if (!item) {
      return notFound();
    }

    // ✅ Render appropriate reader based on item type
    if (item.type === 'book') {
      return <BookReader book={item} />;
    }

    if (item.type === 'piece') {
      return <PieceReader piece={item} />;
    }

    // Fallback for unknown types
    return notFound();
    
  } catch (error: any) {
    console.error('[READ PAGE] Error loading content:', error);
    
    // ✅ If it's an auth error, the middleware should have caught it
    // but just in case, we handle it here too
    if (error.code === 'AUTH') {
      // This will trigger a redirect to login via middleware
      throw error;
    }
    
    // For other errors, show not found page
    return notFound();
  }
}

// ✅ Optional: Add metadata for better SEO
export async function generateMetadata({ params }: ReadPageProps) {
  try {
    const { id } = await params;
    const userId = await getUserIdFromSession();
    const item = await getLibraryItemById(userId, id);
    
    if (!item) {
      return {
        title: 'Content Not Found',
      };
    }

    // Get title from multilingual content
    const title = (item.title as any).primary || Object.values(item.title)[0] || 'Untitled';
    
    return {
      title: Array.isArray(title) ? title.join(' ') : title,
      description: `Read ${item.type === 'book' ? 'book' : 'piece'} on Chirpter`,
    };
  } catch {
    return {
      title: 'Content',
    };
  }
}
