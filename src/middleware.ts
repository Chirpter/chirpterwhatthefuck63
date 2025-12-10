// src/middleware.ts - PRODUCTION READY
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

function isTemporaryError(errorCode: string): boolean {
  const temporaryErrors = [
    'auth/network-request-failed',
    'unavailable',
    'deadline-exceeded',
  ];
  return temporaryErrors.some(code => errorCode?.includes(code));
}

function isPermanentError(errorCode: string): boolean {
  const permanentErrors = [
    'auth/id-token-expired',
    'auth/session-cookie-expired',
    'auth/id-token-revoked',
    'auth/session-cookie-revoked',
    'auth/argument-error',
  ];
  return permanentErrors.some(code => errorCode?.includes(code));
}

/**
 * Verifies session cookie with retry logic for temporary errors
 */
async function verifySessionWithRetry(
  sessionCookie: string, 
  maxRetries = 2
): Promise<{ success: boolean; error?: any; isTemporary?: boolean }> {
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
      
      // Return error with type info
      return { 
        success: false, 
        error,
        isTemporary: isTemporaryError(error.code)
      };
    }
  }
  
  // Max retries exceeded for temporary error
  return { 
    success: false, 
    error: { code: 'max-retries-exceeded' },
    isTemporary: true 
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let isAuthenticated = false;
  let shouldDeleteCookie = false;
  let logoutReason: string | null = null;
  
  const sessionCookie = request.cookies.get('__session')?.value;

  // Verify session if cookie exists
  if (sessionCookie) {
    const { success, error, isTemporary } = await verifySessionWithRetry(sessionCookie);
    
    if (success) {
      isAuthenticated = true;
    } else {
      // Permanent errors: delete cookie and redirect
      if (isPermanentError(error.code)) {
        shouldDeleteCookie = true;
        logoutReason = getLogoutReason(error.code);
        console.error('[Middleware] Permanent auth error, will delete cookie:', error.code);
      }
      // Temporary errors: allow access but don't delete cookie
      else if (isTemporary) {
        isAuthenticated = true; // Gracefully allow access
        console.warn('[Middleware] Temporary auth error, allowing access:', error.code);
      }
      // Unknown errors: treat as permanent
      else {
        shouldDeleteCookie = true;
        logoutReason = 'auth_error';
        console.error('[Middleware] Unknown auth error, will delete cookie:', error.code);
      }
    }
  }

  const isPublicRoute = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isApiRoute = pathname.startsWith('/api/');

  // Don't interfere with API routes
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users from protected routes
  if (!isPublicRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    if (logoutReason) {
      loginUrl.searchParams.set('reason', logoutReason);
    }
    
    const redirectResponse = NextResponse.redirect(loginUrl);
    
    // Delete cookie only for permanent errors
    if (shouldDeleteCookie) {
      redirectResponse.cookies.delete('__session');
    }
    
    return redirectResponse;
  }

  // Redirect authenticated users away from public routes
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  // For successful cases, create response and delete cookie if needed
  const response = NextResponse.next();
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
