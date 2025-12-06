
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

// This line is crucial to tell Next.js to use the Node.js runtime,
// which is required for the Firebase Admin SDK.
export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authAdmin = getAuthAdmin(); // Get admin instance inside the middleware

  // ✅ FIXED: Now verifies session cookie with Admin SDK
  const sessionCookie = request.cookies.get('__session')?.value;
  let isAuthenticated = false;
  
  if (sessionCookie) {
    try {
      // Verify the session cookie with Firebase Admin
      // checkRevoked: true ensures the session hasn't been revoked
      await authAdmin.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
    } catch (error) {
      // Cookie is invalid, expired, or revoked
      console.log('⚠️ Invalid session cookie detected');
      isAuthenticated = false;
      
      // Optional: Clear invalid cookie
      const response = NextResponse.next();
      response.cookies.set('__session', '', {
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
      });
    }
  }

  // Define routes that are public and accessible without authentication.
  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Define all route prefixes that require a user to be authenticated.
  const protectedPrefixes = [
    '/library',
    '/create', 
    '/profile',
    '/settings',
    '/achievements',
    '/shop',
    '/explore',
    '/diary',
    '/learning',
    '/playlist',
    '/admin',
    '/read',
  ];
  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix));

  // --- REDIRECTION LOGIC ---

  // Case 1: An unauthenticated user tries to access a protected route.
  // They are redirected to the login page.
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname); // Pass the original path to redirect back after login.
    return NextResponse.redirect(loginUrl);
  }

  // Case 2: An authenticated user tries to access a public page like /login.
  // They are redirected to their default app page.
  if (isPublicRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  // Case 3: A user visits the root path ('/').
  if (pathname === '/') {
    if (isAuthenticated) {
      // If logged in, redirect to the default library page.
      return NextResponse.redirect(new URL('/library/book', request.url));
    } else {
      // If not logged in, allow access to landing page
      return NextResponse.next(); 
    }
  }

  // If none of the above cases match, allow the request to proceed.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - locales (translation files)
     * - Any file with an extension (e.g., .png, .jpg)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|locales|.*\\..*).*)',
  ],
};
