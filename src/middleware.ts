import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // ✅ FIX: Lazily get authAdmin only when needed
  let authAdmin: ReturnType<typeof getAuthAdmin> | undefined;

  const sessionCookie = request.cookies.get('__session')?.value;
  let isAuthenticated = false;
  
  if (sessionCookie) {
    try {
      authAdmin = getAuthAdmin();
      await authAdmin.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
    } catch (error) {
      // ✅ FIX: Only log, don't clear cookie here (let client handle it)
      console.log('⚠️ Invalid session cookie in middleware');
      isAuthenticated = false;
    }
  }

  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  const protectedPrefixes = [
    '/library', '/create', '/profile', '/settings', 
    '/achievements', '/shop', '/explore', '/diary', 
    '/learning', '/playlist', '/admin', '/read',
  ];
  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix));

  // --- SIMPLIFIED LOGIC ---

  // Case 1: Unauthenticated user tries to access protected route
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Case 2: Authenticated user tries to access login page
  if (isPublicRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  // Case 3: Root path
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/library/book', request.url));
    }
    // Let unauthenticated users see landing page
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales|.*\\..*).*)',
  ],
};
