// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

// Handles creating a session cookie on successful login
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Invalid request: idToken required' }, { status: 400 });
    }

    const authAdmin = getAuthAdmin();
    // Set session cookie to expire in 5 days.
    const expiresIn = 5 * 24 * 60 * 60 * 1000; 

    // Verify the ID token before creating the cookie
    await authAdmin.verifyIdToken(idToken);

    // Create the session cookie
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });
    
    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set({
      name: '__session',
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn / 1000,
    });

    return response;

  } catch (error: any) {
    console.error('[API Session] Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session.', code: error.code }, { status: 401 });
  }
}

// Handles clearing the session cookie on logout
export async function DELETE() {
  const response = NextResponse.json({ success: true }, { status: 200 });
  
  // Instruct the browser to delete the cookie by setting its max-age to 0.
  response.cookies.set({
    name: '__session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
