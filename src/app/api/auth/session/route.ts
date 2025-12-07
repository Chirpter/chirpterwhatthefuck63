// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      console.error('[Session API] Missing or invalid idToken');
      return NextResponse.json(
        { error: 'Invalid request: idToken required' },
        { status: 400 }
      );
    }

    const authAdmin = getAuthAdmin();

    // Verify the ID token first
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    console.log('[Session API] Token verified for user:', decodedToken.uid);

    // Create session cookie (expires in 7 days)
    const expiresIn = 7 * 24 * 60 * 60 * 1000;
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });

    console.log('[Session API] ✅ Session cookie created successfully');

    const response = NextResponse.json(
      { success: true, message: 'Session created' },
      { status: 200 }
    );

    response.cookies.set({
      name: '__session',
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn / 1000,
    });

    console.log('[Session API] Cookie set with attributes:', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn / 1000,
    });

    return response;

  } catch (error: any) {
    console.error('[Session API] ❌ Error creating session:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json(
        { error: 'Token expired. Please log in again.' },
        { status: 401 }
      );
    }
    
    if (error.code === 'auth/argument-error') {
      return NextResponse.json(
        { error: 'Invalid token format.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create session. Please try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  console.log('[Session API] Clearing session cookie...');

  const response = NextResponse.json(
    { success: true, message: 'Session cleared' },
    { status: 200 }
  );

  response.cookies.delete('__session');

  return response;
}