import { NextResponse, type NextRequest } from 'next/server';

// This middleware is now much simpler and faster.
// It ONLY checks for the presence of a session cookie.
// The actual verification of the cookie's validity is handled
// by a background API route, which is a non-blocking approach.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. Check for the session cookie's existence.
  const sessionCookie = request.cookies.get('__session')?.value;
  const isAuthenticated = !!sessionCookie;

  // 2. Define public and protected routes.
  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

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

  // --- REDIRECTION LOGIC (UNCHANGED, BUT NOW FASTER) ---

  // Case 1: Unauthenticated user tries to access a protected route.
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Case 2: Authenticated user tries to access a public page like /login.
  if (isPublicRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }
  
  // Case 3: User visits the root path ('/').
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/library/book', request.url));
    } else {
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
