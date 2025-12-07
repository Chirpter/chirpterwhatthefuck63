import { cookies } from 'next/headers';
import { getAuthAdmin } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Create a session cookie
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    
    if (!idToken) {
      console.error('[Session API] No idToken provided');
      return NextResponse.json(
        { error: 'No idToken provided' }, 
        { status: 400 }
      );
    }
    
    // Set session expiration to 5 days
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    
    console.log('[Session API] Creating session cookie...');
    
    const authAdmin = getAuthAdmin();
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });
    
    console.log('[Session API] ✅ Session cookie created successfully');
    
    // Create response with cookie
    const response = NextResponse.json({ success: true });
    
    response.cookies.set('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });
    
    return response;
    
  } catch (error: any) {
    console.error('[Session API] ❌ Session cookie creation failed:', error.code || error.message);
    return NextResponse.json(
      { error: 'Unauthorized', details: error.code }, 
      { status: 401 }
    );
  }
}

// Delete a session cookie
export async function DELETE(request: NextRequest) {
  try {
    console.log('[Session API] Deleting session cookie...');
    
    const response = NextResponse.json({ success: true });
    
    // Clear the cookie by setting maxAge to 0
    response.cookies.set('__session', '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });
    
    console.log('[Session API] ✅ Session cookie deleted successfully');
    
    return response;
    
  } catch (error) {
    console.error('[Session API] ❌ Session cookie deletion failed:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' }, 
      { status: 500 }
    );
  }
}
