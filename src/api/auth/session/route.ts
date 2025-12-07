// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

// Handles creating a session cookie on successful login
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    console.log('[API Session] Received request to create session.');

    if (!idToken || typeof idToken !== 'string') {
      console.error('[API Session] ❌ Missing or invalid idToken');
      return NextResponse.json({ error: 'Invalid request: idToken required' }, { status: 400 });
    }

    const authAdmin = getAuthAdmin();
    const expiresIn = 5 * 24 * 60 * 60 * 1000; // 5 days

    // Verify the ID token before creating the cookie
    await authAdmin.verifyIdToken(idToken);
    console.log('[API Session] ✅ ID Token verified.');

    // Create the session cookie
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });
    console.log('[API Session] ✅ Session cookie created.');

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
    console.log('[API Session] ✅ Cookie set in response.');

    return response;

  } catch (error: any) {
    console.error('[API Session] ❌ Error creating session:', error.code || error.message);
    return NextResponse.json({ error: 'Failed to create session.', code: error.code }, { status: 401 });
  }
}

// Handles clearing the session cookie on logout
export async function DELETE() {
  console.log('[API Session] Received request to clear session.');
  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set({
    name: '__session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  console.log('[API Session] ✅ Cookie cleared in response.');
  return response;
}
