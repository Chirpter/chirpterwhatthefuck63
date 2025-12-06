
import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

// Simple in-memory cache to reduce Firebase calls for session verification
const verificationCache = new Map<string, { valid: boolean; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// This is a Node.js runtime function, required for Firebase Admin SDK
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('__session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // 1. Check cache first to avoid unnecessary Firebase calls
    const cached = verificationCache.get(sessionCookie);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      if (!cached.valid) {
        return NextResponse.json({ authenticated: false, cached: true }, { status: 401 });
      }
      return NextResponse.json({ authenticated: true, cached: true });
    }

    // 2. If not in cache or cache expired, verify with Firebase
    const authAdmin = getAuthAdmin();
    // `checkRevoked: true` ensures the session isn't revoked
    await authAdmin.verifySessionCookie(sessionCookie, true);
    
    // 3. Cache the successful verification result
    verificationCache.set(sessionCookie, {
      valid: true,
      timestamp: Date.now()
    });

    // 4. Cleanup old cache entries to prevent memory leaks
    if (verificationCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of verificationCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          verificationCache.delete(key);
        }
      }
    }
    
    return NextResponse.json({ authenticated: true, cached: false });

  } catch (error) {
    // Session cookie is invalid, expired, or revoked
    
    // 5. Cache the failed verification result
    const sessionCookie = request.cookies.get('__session')?.value;
    if (sessionCookie) {
      verificationCache.set(sessionCookie, {
        valid: false,
        timestamp: Date.now()
      });
    }
    
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
