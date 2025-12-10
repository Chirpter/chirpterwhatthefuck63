// src/app/api/auth/session/route.ts
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
    
    // ✅ FIX: Verify and check recent sign-in (Firebase best practice)
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authTime = decodedToken.auth_time * 1000; // Convert to ms
    const now = Date.now();
    
    // Only accept if signed in within last 5 minutes
    if (now - authTime > FIVE_MINUTES_MS) {
      return NextResponse.json(
        { error: 'Recent sign in required' }, 
        { status: 401 }
      );
    }

    // Create session cookie
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { 
      expiresIn: FIVE_DAYS_MS 
    });
    
    const response = NextResponse.json({ success: true }, { status: 200 });
    
    // ✅ FIX: sameSite: 'strict' for better security
    response.cookies.set({
      name: '__session',
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Changed from 'lax'
      path: '/',
      maxAge: FIVE_DAYS_MS / 1000,
    });

    return response;

  } catch (error: any) {
    console.error('[API Session] Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session.', code: error.code }, 
      { status: 401 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('__session')?.value;
    
    // ✅ IMPROVEMENT: Revoke refresh tokens if session exists
    if (sessionCookie) {
      const authAdmin = getAuthAdmin();
      try {
        const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie);
        await authAdmin.revokeRefreshTokens(decodedClaims.sub);
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
  response.cookies.set({
    name: '__session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });

  return response;
}