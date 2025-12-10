// src/middleware.ts - FIXED VERSION
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

// ✅ FIXED: Temporary errors should NOT allow access
function isTemporaryError(errorCode: string): boolean {
  const temporaryErrors = [
    'auth/network-request-failed',
    'unavailable',
    'deadline-exceeded',
  ];
  return temporaryErrors.some(code => errorCode?.includes(code));
}

// ✅ FIXED: Retry logic for temporary errors
async function verifySessionWithRetry(
  sessionCookie: string, 
  maxRetries = 2
): Promise<{ success: boolean; error?: any }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const authAdmin = getAuthAdmin();
      await authAdmin.verifySessionCookie(sessionCookie, true);
      return { success: true };
    } catch (error: any) {
      console.error(`[Middleware] Verification attempt ${attempt}/${maxRetries} failed:`, error.code);
      
      // If temporary error and not last attempt, retry
      if (isTemporaryError(error.code) && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        continue;
      }
      
      // Return error on last attempt or permanent error
      return { success: false, error };
    }
  }
  
  return { success: false, error: { code: 'max-retries-exceeded' } };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  let isAuthenticated = false;
  let logoutReason: string | null = null;
  let shouldDeleteCookie = false;
  
  const sessionCookie = request.cookies.get('__session')?.value;

  if (sessionCookie) {
    const { success, error } = await verifySessionWithRetry(sessionCookie);
    
    if (success) {
      isAuthenticated = true;
    } else {
      isAuthenticated = false;
      
      // ✅ FIXED: Temporary errors also redirect, but don't delete cookie
      if (isTemporaryError(error.code)) {
        logoutReason = 'network_error';
        shouldDeleteCookie = false;
        console.warn('[Middleware] Temporary auth error, will redirect but preserve cookie');
      } else {
        // Permanent error - delete cookie
        logoutReason = getLogoutReason(error.code || 'unknown_error');
        shouldDeleteCookie = true;
        console.error('[Middleware] Permanent auth error, will delete cookie:', error.code);
      }
    }
  }

  const isPublicRoute = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isApiRoute = pathname.startsWith('/api/');

  // ✅ Don't interfere with API routes
  if (isApiRoute) {
    return response;
  }

  // ✅ FIXED: Always redirect if not authenticated (even for temporary errors)
  if (!isPublicRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    if (logoutReason) {
      loginUrl.searchParams.set('reason', logoutReason);
    }
    
    const redirectResponse = NextResponse.redirect(loginUrl);
    
    // Only delete cookie for permanent errors
    if (shouldDeleteCookie) {
      redirectResponse.cookies.delete('__session');
    }
    
    return redirectResponse;
  }

  // ✅ Redirect authenticated users away from public routes
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  // ✅ Delete cookie for permanent errors even on public routes
  if (shouldDeleteCookie) {
    response.cookies.delete('__session');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};