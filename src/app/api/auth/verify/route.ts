import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebase-admin';

// Simple in-memory cache to reduce Firebase calls for session verification
const verificationCache = new Map<string, { valid: boolean; timestamp: number; uid?: string }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get('__session')?.value;
  
  try {
    if (!sessionCookie) {
      console.log('[Verify API] No session cookie found');
      return NextResponse.json(
        { authenticated: false, error: 'No session cookie' }, 
        { status: 401 }
      );
    }

    // 1. Check cache first to avoid unnecessary Firebase calls
    const cached = verificationCache.get(sessionCookie);
    const now = Date.now();
    
    if (cached && now - cached.timestamp < CACHE_TTL) {
      if (!cached.valid) {
        console.log('[Verify API] ⚠️ Cached invalid session');
        
        // Clear invalid cookie
        const response = NextResponse.json(
          { authenticated: false, cached: true }, 
          { status: 401 }
        );
        response.cookies.delete('__session');
        return response;
      }
      
      console.log('[Verify API] ✅ Cached valid session for:', cached.uid);
      return NextResponse.json({ 
        authenticated: true, 
        cached: true,
        uid: cached.uid 
      });
    }

    // 2. If not in cache or cache expired, verify with Firebase
    console.log('[Verify API] Verifying session with Firebase...');
    
    const authAdmin = getAuthAdmin();
    const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie, true);
    
    // 3. Cache the successful verification result
    verificationCache.set(sessionCookie, {
      valid: true,
      timestamp: now,
      uid: decodedClaims.uid
    });

    console.log('[Verify API] ✅ Session verified for user:', decodedClaims.uid);

    // 4. Cleanup old cache entries to prevent memory leaks
    if (verificationCache.size > 1000) {
      console.log('[Verify API] 🧹 Cleaning up cache...');
      for (const [key, value] of verificationCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          verificationCache.delete(key);
        }
      }
    }
    
    return NextResponse.json({ 
      authenticated: true, 
      cached: false,
      uid: decodedClaims.uid 
    });

  } catch (error: any) {
    // Session cookie is invalid, expired, or revoked
    console.error('[Verify API] ❌ Verification failed:', error.code || error.message);
    
    // 5. Cache the failed verification result
    if (sessionCookie) {
      verificationCache.set(sessionCookie, {
        valid: false,
        timestamp: Date.now()
      });
    }
    
    // 6. Clear invalid cookie from client
    const response = NextResponse.json(
      { 
        authenticated: false, 
        error: error.code || 'Invalid session',
        cached: false 
      }, 
      { status: 401 }
    );
    
    response.cookies.delete('__session');
    
    return response;
  }
}