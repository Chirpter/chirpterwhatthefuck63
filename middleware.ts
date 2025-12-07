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
    case 'auth/invalid-credential':
      return 'invalid_session';
    default:
      return 'auth_error';
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  console.log(`[Middleware] Processing: ${pathname}`);
  
  const sessionCookie = request.cookies.get('__session')?.value;
  let isAuthenticated = false;
  let logoutReason: string | null = null;
  
  const response = NextResponse.next();
  
  if (sessionCookie) {
    try {
      const authAdmin = getAuthAdmin();
      const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie, true);
      
      isAuthenticated = true;
      console.log(`[Middleware] ✅ Valid session for user: ${decodedClaims.uid}`);
      
      response.headers.set('X-User-Id', decodedClaims.uid);
      
    } catch (error: any) {
      const errorCode = error.code || 'unknown';
      logoutReason = getLogoutReason(errorCode);
      
      console.log(`[Middleware] ⚠️ Invalid session: ${errorCode} → Reason: ${logoutReason}`);
      isAuthenticated = false;
      
      response.cookies.delete('__session');
      
      if (logoutReason) {
        response.cookies.set('logout_reason', logoutReason, {
          httpOnly: false,
          maxAge: 10,
          sameSite: 'lax',
          path: '/',
        });
      }
    }
  } else {
    console.log('[Middleware] No session cookie found');
  }

  const publicRoutes = ['/login', '/signup'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  const protectedPrefixes = [
    '/library', '/create', '/profile', '/settings', 
    '/achievements', '/shop', '/explore', '/diary', 
    '/learning', '/playlist', '/admin', '/read',
  ];
  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix));

  if (isProtectedRoute && !isAuthenticated) {
    console.log(`[Middleware] 🚫 Redirecting unauthenticated user to /login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    
    if (logoutReason) {
      loginUrl.searchParams.set('reason', logoutReason);
    }
    
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicRoute && isAuthenticated) {
    console.log(`[Middleware] ✅ Redirecting authenticated user to /library/book`);
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  if (pathname === '/') {
    if (isAuthenticated) {
      console.log(`[Middleware] Root → /library/book (authenticated)`);
      return NextResponse.redirect(new URL('/library/book', request.url));
    }
    console.log(`[Middleware] Root → Landing page (unauthenticated)`);
  }

  if (pathname.startsWith('/api') || pathname.includes('.')) {
    return response;
  }

  console.log(`[Middleware] ✅ Allowing access to: ${pathname}`);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};