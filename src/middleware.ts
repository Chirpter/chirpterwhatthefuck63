// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

function getLogoutReason(errorCode: string): string {
  switch (errorCode) {
    case 'auth/id-token-expired':
    case 'auth/session-cookie-expired':
      return 'session_expired';
    case 'auth/id-token-revoked':
    case 'auth/session-cookie-revoked':
      return 'session_revoked';
    case 'auth/argument-error':
      return 'invalid_session';
    default:
      return 'auth_error';
  }
}

//  IMPROVEMENT: Differentiate temporary vs permanent errors
function isTemporaryError(errorCode: string): boolean {
  const temporaryErrors = [
    'auth/network-request-failed',
    'unavailable',
    'deadline-exceeded',
  ];
  return temporaryErrors.some(code => errorCode?.includes(code));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  let isAuthenticated = false;
  let logoutReason: string | null = null;
  
  const sessionCookie = request.cookies.get('__session')?.value;

  if (sessionCookie) {
    try {
      const authAdmin = getAuthAdmin();
      await authAdmin.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
    } catch (error: any) {
      isAuthenticated = false;
      
      // ✅ FIX: Don't delete cookie for temporary errors
      if (isTemporaryError(error.code)) {
        logoutReason = 'network_error';
        console.warn('[Middleware] Temporary auth error:', error.code);
      } else {
        // Permanent error - delete cookie
        logoutReason = getLogoutReason(error.code || 'unknown_error');
        response.cookies.delete('__session');
        console.error('[Middleware] Auth verification failed:', error.code);
      }
    }
  }

  const isPublicRoute = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isApiRoute = pathname.startsWith('/api/');

  if (isApiRoute) {
    return response;
  }

  if (!isPublicRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    if (logoutReason) {
      loginUrl.searchParams.set('reason', logoutReason);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};