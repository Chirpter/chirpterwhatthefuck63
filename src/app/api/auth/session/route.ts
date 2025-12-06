
import { cookies } from 'next/headers';
import { getAuthAdmin } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

// Create a session cookie
export async function POST(request: NextRequest) {
  const { idToken } = await request.json();
  
  // Set session expiration to 5 days.
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
  
  try {
    const authAdmin = getAuthAdmin(); // Get instance inside the function
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });
    
    // Create a response object to set the cookie on
    const response = NextResponse.json({ success: true });
    
    // Set cookie policy for session cookie on the response
    response.cookies.set('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });
    
    return response;
  } catch (error) {
    console.error('Session cookie creation failed:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

// Delete a session cookie
export async function DELETE(request: NextRequest) {
  try {
    // Create a response object to clear the cookie on
    const response = NextResponse.json({ success: true });
    
    // Set the cookie with a maxAge of 0 to delete it
    response.cookies.set('__session', '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });
    
    return response;
  } catch (error) {
    console.error('Session cookie deletion failed:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
