// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';
import { logAuthEvent } from '@/lib/analytics'; // Assuming you have analytics

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
      await authAdmin.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
      console.log(`[Middleware] ✅ Valid session for path: ${pathname}`);
    } catch (error: any) {
      isAuthenticated = false;
      const errorCode = error.code || 'unknown_error';
      logoutReason = getLogoutReason(errorCode);
      
      console.warn(`[Middleware] ⚠️ Invalid session for path: ${pathname}. Error: ${errorCode}. Logging out.`);
      
      // If the cookie is invalid, delete it from the user's browser
      response.cookies.delete('__session');
    }
  }

  // 3. Define public and protected routes
  const publicRoutes = ['/login', '/signup', '/api/auth/session'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  const protectedPrefixes = ['/library', '/create', '/profile', '/settings', '/achievements', '/shop', '/explore', '/diary', '/learning', '/playlist', '/admin', '/read'];
  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix));

  // 4. Handle redirection logic
  // If trying to access a protected route without being authenticated
  if (isProtectedRoute && !isAuthenticated) {
    console.log(`[Middleware] 🚫 Unauthenticated access to protected route ${pathname}. Redirecting to /login.`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    if (logoutReason) {
      loginUrl.searchParams.set('reason', logoutReason);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access a public route (like login) while already authenticated
  if (isPublicRoute && isAuthenticated) {
    console.log(`[Middleware] ✅ Authenticated user accessing public route. Redirecting to /library/book.`);
    return NextResponse.redirect(new URL('/library/book', request.url));
  }
  
  // Handle root path redirection
  if (pathname === '/') {
    const targetUrl = isAuthenticated ? '/library/book' : '/login';
    console.log(`[Middleware] Root access. Redirecting to ${targetUrl}.`);
    return NextResponse.redirect(new URL(targetUrl, request.url));
  }

  // If no redirection is needed, just continue to the requested page
  console.log(`[Middleware] ✅ Allowing access to: ${pathname}`);
  return response;
}

// Configure the matcher to run on all paths except static assets
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
