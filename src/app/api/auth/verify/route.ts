// src/app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('[Verify API] Checking session cookie...');
    
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;

    if (!sessionCookie) {
      console.log('[Verify API] ❌ No session cookie found');
      return NextResponse.json(
        { error: 'No session cookie', authenticated: false },
        { status: 401 }
      );
    }

    const authAdmin = getAuthAdmin();
    
    const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie, true);
    
    console.log('[Verify API] ✅ Session valid for user:', decodedClaims.uid);

    return NextResponse.json({
      authenticated: true,
      uid: decodedClaims.uid,
      email: decodedClaims.email,
    });

  } catch (error: any) {
    console.error('[Verify API] ❌ Verification failed:', error.code || error.message);
    
    return NextResponse.json(
      { 
        error: 'Invalid session',
        authenticated: false,
        code: error.code 
      },
      { status: 401 }
    );
  }
}