import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Noto_Serif } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import { Logo } from '@/components/ui/Logo';
import { getSystemBookmarks, getBookmarkMetadata } from '@/services/bookmark-service';
import type { CombinedBookmark } from '@/lib/types';
import { ClientProviders } from '@/providers/client-providers';

const notoSerif = Noto_Serif({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-noto-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Chirpter',
  description: 'Create, manage, and read books with AI assistance.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

const Loader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="hero-loader-logo-fill">
      <Logo className="h-24 w-24 animate-pulse text-primary" />
    </div>
  </div>
);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let combinedBookmarks: CombinedBookmark[] = [];
  
  try {
    const [systemBookmarks, metadata] = await Promise.all([
      getSystemBookmarks(),
      getBookmarkMetadata()
    ]);
    
    const metadataMap = new Map(metadata.map(m => [m.id, m]));
    
    combinedBookmarks = systemBookmarks.map(bookmark => ({
      ...bookmark,
      ...(metadataMap.get(bookmark.id) || {}),
    }));
  } catch (error) {
    console.error("Failed to load global bookmark data in RootLayout:", error);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        "font-serif",
        notoSerif.variable
      )}>
        <Suspense fallback={<Loader />}>
          <ClientProviders initialBookmarks={combinedBookmarks}>
            {children}
          </ClientProviders>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
