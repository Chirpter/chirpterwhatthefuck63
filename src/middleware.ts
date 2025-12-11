// src/middleware.ts - WITH PERFORMANCE MONITORING
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

// ⏱️ PERFORMANCE LOGGER
const perfLog = (label: string, startTime: number, pathname: string) => {
  const duration = performance.now() - startTime;
  const color = duration < 50 ? '🟢' : duration < 200 ? '🟡' : '🔴';
  console.log(`${color} [MIDDLEWARE PERF] ${pathname} - ${label}: ${duration.toFixed(2)}ms`);
  return duration;
};

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

async function verifySessionWithRetry(
  sessionCookie: string, 
  maxRetries = 2
): Promise<{ success: boolean; error?: any; isTemporary?: boolean }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStart = performance.now();
    
    try {
      const authAdmin = getAuthAdmin();
      await authAdmin.verifySessionCookie(sessionCookie, true);
      perfLog(`✅ Verification attempt ${attempt}`, attemptStart, 'middleware');
      return { success: true };
    } catch (error: any) {
      console.error(`❌ [MIDDLEWARE] Verification attempt ${attempt}/${maxRetries} failed:`, error.code);
      perfLog(`❌ Verification attempt ${attempt} failed`, attemptStart, 'middleware');
      
      if (isTemporaryError(error.code) && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        continue;
      }
      
      return { 
        success: false, 
        error,
        isTemporary: isTemporaryError(error.code)
      };
    }
  }
  
  return { 
    success: false, 
    error: { code: 'max-retries-exceeded' },
    isTemporary: true 
  };
}

export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  const { pathname } = request.nextUrl;
  
  console.log(`🛡️  [MIDDLEWARE] Checking auth for: ${pathname}`);
  
  let isAuthenticated = false;
  let shouldDeleteCookie = false;
  let logoutReason: string | null = null;
  
  const sessionCookie = request.cookies.get('__session')?.value;

  // Step 1: Verify session if cookie exists
  if (sessionCookie) {
    const verifyStart = performance.now();
    const { success, error, isTemporary } = await verifySessionWithRetry(sessionCookie);
    perfLog('Session verification', verifyStart, pathname);
    
    if (success) {
      isAuthenticated = true;
    } else {
      if (isPermanentError(error.code)) {
        shouldDeleteCookie = true;
        logoutReason = getLogoutReason(error.code);
        console.error('❌ [MIDDLEWARE] Permanent auth error:', error.code);
      } else if (isTemporary) {
        isAuthenticated = true;
        console.warn('⚠️  [MIDDLEWARE] Temporary auth error, allowing access:', error.code);
      } else {
        shouldDeleteCookie = true;
        logoutReason = 'auth_error';
        console.error('❌ [MIDDLEWARE] Unknown auth error:', error.code);
      }
    }
  }

  const isPublicRoute = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isApiRoute = pathname.startsWith('/api/');

  // Don't interfere with API routes
  if (isApiRoute) {
    perfLog('✅ API route - passthrough', startTime, pathname);
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
    
    if (shouldDeleteCookie) {
      redirectResponse.cookies.delete('__session');
    }
    
    perfLog('❌ Redirect to login', startTime, pathname);
    return redirectResponse;
  }

  // Redirect authenticated users away from public routes
  if (isAuthenticated && isPublicRoute) {
    perfLog('↪️  Redirect to library', startTime, pathname);
    return NextResponse.redirect(new URL('/library/book', request.url));
  }

  const response = NextResponse.next();
  if (shouldDeleteCookie) {
    response.cookies.delete('__session');
  }

  perfLog('✅ Request allowed', startTime, pathname);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};