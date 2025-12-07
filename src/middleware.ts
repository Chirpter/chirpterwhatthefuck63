import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  console.log(`[Middleware] Processing: ${pathname}`);
  
  const sessionCookie = request.cookies.get('__session')?.value;
  let isAuthenticated = false;
  
  // Create a response object early to modify its headers if needed
  const response = NextResponse.next();
  
  if (sessionCookie) {
    try {
      const authAdmin = getAuthAdmin();
      await authAdmin.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
      console.log(`[Middleware] ✅ Valid session cookie found.`);
    } catch (error: any) {
      console.log(`[Middleware] ⚠️ Invalid/expired session cookie: ${error.code}. Deleting cookie.`);
      isAuthenticated = false;
      // If the cookie is invalid, delete it from the user's browser.
      response.cookies.delete('__session');
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

  // --- ROUTE LOGIC ---

  // Case 1: Unauthenticated user accessing protected route
  if (isProtectedRoute && !isAuthenticated) {
    console.log(`[Middleware] 🚫 Redirecting unauthenticated user to /login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Case 2: Authenticated user accessing login page
  if (isPublicRoute && isAuthenticated) {
    console.log(`[Middleware] ✅ Redirecting authenticated user to /library/book`);
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  // Case 3: Root path
  if (pathname === '/') {
    if (isAuthenticated) {
      console.log(`[Middleware] Root → /library/book (authenticated)`);
      return NextResponse.redirect(new URL('/library/book', request.url));
    }
    // Allow unauthenticated users to see landing page
    console.log(`[Middleware] Root → Landing page (unauthenticated)`);
  }

  // Case 4: API routes and assets - always allow
  // We use the response object created earlier to pass through the request,
  // potentially with a deleted cookie if it was invalid.
  if (pathname.startsWith('/api') || pathname.includes('.')) {
    return response;
  }

  console.log(`[Middleware] ✅ Allowing access to: ${pathname}`);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
