// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

// Explicitly set the runtime to 'nodejs' to ensure compatibility
// with Firebase Admin SDK, which uses Node.js APIs.
export const runtime = 'nodejs';

// Function to determine logout reason from error code
function getLogoutReason(errorCode: string): string {
  switch (errorCode) {
    case 'auth/id-token-expired':
    case 'auth/session-cookie-expired':
      return 'session_expired';
    case 'auth/id-token-revoked':
    case 'auth/session-cookie-revoked':
      return 'session_revoked';
    default:
      return 'auth_error';
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  let isAuthenticated = false;
  let logoutReason: string | null = null;
  
  // 1. Get the session cookie
  const sessionCookie = request.cookies.get('__session')?.value;

  // 2. Verify the session cookie if it exists
  if (sessionCookie) {
    try {
      const authAdmin = getAuthAdmin();
      // The `true` checks for revoked tokens
      await authAdmin.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
    } catch (error: any) {
      isAuthenticated = false;
      const errorCode = error.code || 'unknown_error';
      logoutReason = getLogoutReason(errorCode);
      
      // If the cookie is invalid, explicitly delete it from the user's browser.
      // This is crucial to break redirect loops.
      response.cookies.delete('__session');
    }
  }

  // 3. Define public and protected routes
  const publicRoutes = ['/login', '/signup', '/api/auth/session'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // Protected routes require authentication
  const protectedPrefixes = ['/library', '/create', '/profile', '/settings', '/achievements', '/shop', '/explore', '/diary', '/learning', '/playlist', '/admin', '/read'];
  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix));

  // 4. Handle redirection logic based on authentication status

  // If trying to access a protected route without being authenticated, redirect to login.
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    if (logoutReason) {
      loginUrl.searchParams.set('reason', logoutReason);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access a public route (like login) while already authenticated, redirect to the app.
  if (isPublicRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }
  
  // Handle the root path ('/'). Redirect to the app if logged in, or to login if not.
  if (pathname === '/') {
    const targetUrl = isAuthenticated ? '/library/book' : '/login';
    return NextResponse.redirect(new URL(targetUrl, request.url));
  }

  // If no redirection is needed, allow the request to proceed.
  return response;
}

// Configure the matcher to run on all paths except for static assets and API routes needed for auth.
// We exclude the /api/auth/session route from the main logic but handle it within the function.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
