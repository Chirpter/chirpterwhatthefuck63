import type { Metadata } from "next";
import { Noto_Serif, Inter } from "next/font/google";
import "./globals.css";
import { getSystemBookmarks, getBookmarkMetadata } from '@/services/bookmark-service';
import { ClientProviders } from '@/providers/client-providers';

const notoSerif = Noto_Serif({ 
  subsets: ["latin", "vietnamese"],
  variable: "--font-noto-serif",
  display: 'swap',
});

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Chirpter",
  description: "AI-powered book creation and learning platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch initial global data on the server in parallel
  const [systemBookmarks, bookmarkMetadata] = await Promise.all([
    getSystemBookmarks(),
    getBookmarkMetadata()
  ]);

  // Combine the data on the server before passing it down
  const combinedBookmarks = systemBookmarks.map(bookmark => ({
    ...bookmark,
    ...(bookmarkMetadata.find(m => m.id === bookmark.id) || {}),
  }));

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to Firebase services for faster auth */}
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="preconnect" href="https://securetoken.googleapis.com" />
        <link rel="preconnect" href="https://www.googleapis.com" />
        <link rel="dns-prefetch" href="https://firebaseinstallations.googleapis.com" />
      </head>
      <body className={`${notoSerif.variable} ${inter.variable} font-body antialiased`}>
        {/* Pass server-fetched data to the client-side provider */}
        <ClientProviders initialBookmarks={combinedBookmarks}>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
