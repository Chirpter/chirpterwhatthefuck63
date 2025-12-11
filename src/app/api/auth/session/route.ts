// src/app/api/auth/session/route.ts - WITH PERFORMANCE MONITORING
import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const FIVE_MINUTES_S = 5 * 60;

// ⏱️ PERFORMANCE LOGGER
const perfLog = (label: string, startTime: number) => {
  const duration = performance.now() - startTime;
  const color = duration < 50 ? '🟢' : duration < 150 ? '🟡' : '🔴';
  console.log(`${color} [API PERF] ${label}: ${duration.toFixed(2)}ms`);
  return duration;
};

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  console.log('🔍 [API] GET /api/auth/session - Verifying session');
  
  const sessionCookie = request.cookies.get('__session')?.value;
  
  if (!sessionCookie) {
    perfLog('GET - No session cookie', startTime);
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }
  
  try {
    const verifyStart = performance.now();
    const authAdmin = getAuthAdmin();
    await authAdmin.verifySessionCookie(sessionCookie, true);
    perfLog('Session verification', verifyStart);
    
    perfLog('✅ GET - Total', startTime);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('❌ [API] Invalid session:', error.code);
    perfLog('❌ GET - Failed', startTime);
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  console.log('🔐 [API] POST /api/auth/session - Creating session');
  
  try {
    // Step 1: Parse request body
    const parseStart = performance.now();
    const { idToken } = await request.json();
    perfLog('Parse request body', parseStart);

    if (!idToken || typeof idToken !== 'string') {
      perfLog('❌ POST - Invalid request', startTime);
      return NextResponse.json({ error: 'Invalid request: idToken required' }, { status: 400 });
    }

    // Step 2: Get Auth Admin
    const adminStart = performance.now();
    const authAdmin = getAuthAdmin();
    perfLog('Get Auth Admin', adminStart);
    
    // Step 3: Verify ID Token
    let decodedToken;
    try {
      const verifyStart = performance.now();
      decodedToken = await authAdmin.verifyIdToken(idToken);
      perfLog('Verify ID Token', verifyStart);
    } catch (verifyError: any) {
      console.error('❌ [API] Token verification failed:', verifyError.code);
      perfLog('❌ POST - Token verification failed', startTime);
      return NextResponse.json(
        { error: 'Failed to create session.', code: verifyError.code }, 
        { status: 401 }
      );
    }
    
    // Step 4: Check recent sign-in
    const authTime = decodedToken.auth_time || Math.floor(Date.now() / 1000);
    const nowInSeconds = Math.floor(Date.now() / 1000);
    
    if (nowInSeconds - authTime > FIVE_MINUTES_S) {
      console.warn('⚠️  [API] Sign-in not recent:', { authTime, now: nowInSeconds });
      perfLog('❌ POST - Not recent sign-in', startTime);
      return NextResponse.json(
        { error: 'Recent sign in required' }, 
        { status: 401 }
      );
    }

    // Step 5: Create session cookie
    let sessionCookie;
    try {
      const cookieStart = performance.now();
      sessionCookie = await authAdmin.createSessionCookie(idToken, { 
        expiresIn: FIVE_DAYS_MS 
      });
      perfLog('Create session cookie', cookieStart);
    } catch (cookieError: any) {
      console.error('❌ [API] Failed to create session cookie:', cookieError.code);
      perfLog('❌ POST - Cookie creation failed', startTime);
      return NextResponse.json(
        { error: 'Failed to create session.', code: cookieError.code }, 
        { status: 401 }
      );
    }
    
    // Step 6: Set cookie in response
    const responseStart = performance.now();
    const response = NextResponse.json({ success: true }, { status: 200 });
    
    response.cookies.set({
      name: '__session',
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: FIVE_DAYS_MS / 1000,
    });
    perfLog('Set cookie in response', responseStart);

    perfLog('✅ POST - Total session creation', startTime);
    console.log('✅ [API] Session cookie created for user:', decodedToken.uid);
    return response;

  } catch (error: any) {
    console.error('❌ [API] Unexpected error:', error);
    perfLog('❌ POST - Unexpected error', startTime);
    return NextResponse.json(
      { error: 'Failed to create session.', code: error.code }, 
      { status: 401 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = performance.now();
  console.log('🚪 [API] DELETE /api/auth/session - Logging out');
  
  const sessionCookie = request.cookies.get('__session')?.value;
  
  // Always return success response first
  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.delete('__session');
  
  perfLog('Cookie deleted from response', startTime);
  
  // Revoke tokens in background
  if (sessionCookie) {
    (async () => {
      try {
        const revokeStart = performance.now();
        const authAdmin = getAuthAdmin();
        const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie);
        await authAdmin.revokeRefreshTokens(decodedClaims.sub);
        perfLog('Background token revocation', revokeStart);
        console.log('✅ [API] Tokens revoked for user:', decodedClaims.sub);
      } catch (err) {
        console.warn('⚠️  [API] Could not revoke tokens:', err);
      }
    })();
  }

  perfLog('✅ DELETE - Total', startTime);
  return response;
}