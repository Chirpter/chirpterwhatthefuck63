// src/app/api/auth/session/route.ts - PRODUCTION READY
import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

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
    
    const authTime = decodedToken.auth_time * 1000; // Convert to ms
    const now = Date.now();
    
    // Check if sign-in is recent (within 5 minutes)
    if (now - authTime > FIVE_MINUTES_MS) {
      console.warn('[API Session] Sign-in not recent enough:', { authTime, now, diff: now - authTime });
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
  try {
    const sessionCookie = request.cookies.get('__session')?.value;
    
    // Revoke refresh tokens if session exists
    if (sessionCookie) {
      const authAdmin = getAuthAdmin();
      try {
        const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie);
        await authAdmin.revokeRefreshTokens(decodedClaims.sub);
        console.log('[API Session] Tokens revoked for user:', decodedClaims.sub);
      } catch (err) {
        // Log but don't fail - cookie will be cleared anyway
        console.warn('[API Session] Could not revoke tokens:', err);
      }
    }
  } catch (error) {
    console.error('[API Session] Error during logout:', error);
  }
  
  // Always clear cookie (idempotent operation)
  const response = NextResponse.json({ success: true }, { status: 200 });
  
  // Use delete() method for proper cookie removal
  response.cookies.delete('__session');

  console.log('[API Session] Session cookie cleared');
  return response;
}
