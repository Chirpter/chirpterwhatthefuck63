// src/middleware.ts - SIMPLIFIED AND MORE ROBUST
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

// Helper to determine the reason for logout for better UX on the login page
function getLogoutReason(errorCode: string): string {
  switch (errorCode) {
    case 'auth/session-cookie-expired':
      return 'session_expired';
    case 'auth/session-cookie-revoked':
      return 'session_revoked';
    default:
      return 'auth_error'; // Generic reason
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('__session')?.value;

  // Let static files and API routes pass through without checks.
  // The API routes should perform their own authentication checks if necessary.
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/') || pathname.includes('.')) {
    return NextResponse.next();
  }

  let isAuthenticated = false;
  let shouldClearCookie = false;
  let redirectReason: string | null = null;
  
  if (sessionCookie) {
    try {
      await getAuthAdmin().verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
    } catch (error: any) {
      // If the cookie is invalid (expired, revoked, etc.), mark it for deletion.
      console.warn(`[MIDDLEWARE] Invalid session for path "${pathname}":`, error.code);
      shouldClearCookie = true;
      redirectReason = getLogoutReason(error.code);
    }
  }

  const isPublicRoute = pathname === '/' || pathname.startsWith('/login');

  // --- REDIRECTION LOGIC ---

  // 1. If trying to access a protected route without being authenticated
  if (!isPublicRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    if (redirectReason) {
      loginUrl.searchParams.set('reason', redirectReason);
    }
    
    const response = NextResponse.redirect(loginUrl);
    if (shouldClearCookie) {
      response.cookies.delete('__session');
    }
    return response;
  }

  // 2. If authenticated and trying to access a public route (like /login)
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  // --- REGULAR RESPONSE ---
  const response = NextResponse.next();
  
  // If we detected an invalid cookie earlier, clear it from the user's browser.
  if (shouldClearCookie) {
    response.cookies.delete('__session');
  }

  return response;
}

export const config = {
  // This matcher ensures the middleware runs on all routes except for static files and specific assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
