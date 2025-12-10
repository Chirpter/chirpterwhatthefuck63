// src/app/api/auth/session/route.ts - PRODUCTION READY (WITH GET ENDPOINT)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const FIVE_MINUTES_S = 5 * 60;

/**
 * ✅ NEW: GET endpoint to verify session cookie
 * Used by client to check if cookie is properly set
 */
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('__session')?.value;
  
  if (!sessionCookie) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }
  
  try {
    const authAdmin = getAuthAdmin();
    await authAdmin.verifySessionCookie(sessionCookie, true);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[API Session GET] Invalid session:', error.code);
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Invalid request: idToken required' }, { status: 400 });
    }

    const authAdmin = getAuthAdmin();
    
    // Verify token and check recent sign-in
    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (verifyError: any) {
      console.error('[API Session] Token verification failed:', verifyError.code);
      return NextResponse.json(
        { error: 'Failed to create session.', code: verifyError.code }, 
        { status: 401 }
      );
    }
    
    // Safe access to auth_time with fallback
    const authTime = decodedToken.auth_time || Math.floor(Date.now() / 1000);
    const nowInSeconds = Math.floor(Date.now() / 1000);
    
    // Check if sign-in is recent (within 5 minutes)
    if (nowInSeconds - authTime > FIVE_MINUTES_S) {
      console.warn('[API Session] Sign-in not recent enough:', { authTime, now: nowInSeconds, diff: nowInSeconds - authTime });
      return NextResponse.json(
        { error: 'Recent sign in required' }, 
        { status: 401 }
      );
    }

    // Create session cookie
    let sessionCookie;
    try {
      sessionCookie = await authAdmin.createSessionCookie(idToken, { 
        expiresIn: FIVE_DAYS_MS 
      });
    } catch (cookieError: any) {
      console.error('[API Session] Failed to create session cookie:', cookieError.code);
      return NextResponse.json(
        { error: 'Failed to create session.', code: cookieError.code }, 
        { status: 401 }
      );
    }
    
    const response = NextResponse.json({ success: true }, { status: 200 });
    
    // Set cookie with strict security settings
    response.cookies.set({
      name: '__session',
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: FIVE_DAYS_MS / 1000,
    });

    console.log('[API Session] Session cookie created successfully for user:', decodedToken.uid);
    return response;

  } catch (error: any) {
    console.error('[API Session] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to create session.', code: error.code }, 
      { status: 401 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const sessionCookie = request.cookies.get('__session')?.value;
  
  // Always return success response first
  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.delete('__session');
  
  // Revoke tokens in background, don't block response
  if (sessionCookie) {
    // Fire and forget - don't await
    (async () => {
      try {
        const authAdmin = getAuthAdmin();
        const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie);
        await authAdmin.revokeRefreshTokens(decodedClaims.sub);
        console.log('[API Session] Tokens revoked for user:', decodedClaims.sub);
      } catch (err) {
        console.warn('[API Session] Could not revoke tokens:', err);
      }
    })();
  }

  console.log('[API Session] Session cookie cleared');
  return response;
}