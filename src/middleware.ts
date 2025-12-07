// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

// Explicitly set the runtime to 'nodejs' to ensure compatibility
// with Firebase Admin SDK, which uses Node.js APIs.
export const runtime = 'nodejs';

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
  
  const sessionCookie = request.cookies.get('__session')?.value;

  if (sessionCookie) {
    try {
      const authAdmin = getAuthAdmin();
      await authAdmin.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
    } catch (error: any) {
      isAuthenticated = false;
      logoutReason = getLogoutReason(error.code || 'unknown_error');
      response.cookies.delete('__session');
    }
  }

  const publicRoutes = ['/login', '/signup', '/api/auth/session'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || pathname === '/';

  const protectedRoutes = ['/library', '/create', '/profile', '/settings', '/achievements', '/shop', '/explore', '/diary', '/learning', '/playlist', '/admin', '/read'];
  const isProtectedRoute = protectedRoutes.some(prefix => pathname.startsWith(prefix));

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    if (logoutReason) {
      loginUrl.searchParams.set('reason', logoutReason);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated and tries to access login/signup, redirect to library
  if (isAuthenticated && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  // If user is authenticated and at the root, redirect to library
  if (isAuthenticated && pathname === '/') {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }
  
  // If user is NOT authenticated and at a protected root like `/library`, redirect to `/login`
  // This handles cases where user directly navigates to `/library`
  if (!isAuthenticated && pathname === '/library') {
      return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
