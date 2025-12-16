// src/middleware.ts - ENHANCED VERSION
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

// Helper to determine the reason for logout
function getLogoutReason(errorCode: string): string {
  switch (errorCode) {
    case 'auth/session-cookie-expired':
      return 'session_expired';
    case 'auth/session-cookie-revoked':
      return 'session_revoked';
    case 'auth/argument-error':
      return 'invalid_session';
    default:
      return 'auth_error';
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('__session')?.value;

  // ✅ Let static files and API routes pass through without checks
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
      console.warn(`[MIDDLEWARE] Invalid session for path "${pathname}":`, error.code);
      shouldClearCookie = true;
      redirectReason = getLogoutReason(error.code);
    }
  }

  const isPublicRoute = pathname === '/' || pathname.startsWith('/login');

  // --- REDIRECTION LOGIC ---

  // 1. Protected route without authentication
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

  // 2. Authenticated user on public route
  if (isAuthenticated && isPublicRoute) {
    // ✅ IMPROVED: Check for 'next' parameter to redirect properly
    const next = request.nextUrl.searchParams.get('next');
    const redirectUrl = next && next.startsWith('/') ? next : '/library/book';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // --- REGULAR RESPONSE ---
  const response = NextResponse.next();
  
  if (shouldClearCookie) {
    response.cookies.delete('__session');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};