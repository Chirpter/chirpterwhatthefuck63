// src/app/api/auth/session/__tests__/route.test.ts - PRODUCTION READY
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, DELETE } from '../route';
import { NextRequest } from 'next/server';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  getAuthAdmin: vi.fn(() => ({
    verifyIdToken: vi.fn(),
    createSessionCookie: vi.fn(),
    verifySessionCookie: vi.fn(),
    revokeRefreshTokens: vi.fn(),
  })),
}));

const { getAuthAdmin } = await import('@/lib/firebase-admin');

describe('POST /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if idToken is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request: idToken required');
  });

  it('should return 401 if sign-in is not recent', async () => {
    const mockAuthAdmin = getAuthAdmin();
    
    // Mock token that was signed in > 5 minutes ago
    const oldAuthTime = Math.floor(Date.now() / 1000) - (10 * 60); // 10 minutes ago
    vi.mocked(mockAuthAdmin.verifyIdToken).mockResolvedValue({
      auth_time: oldAuthTime,
      uid: 'test-uid',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'fake-token' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Recent sign in required');
  });

  it('should create session cookie for recent sign-in', async () => {
    const mockAuthAdmin = getAuthAdmin();
    
    // Mock recent sign-in (within last minute)
    const recentAuthTime = Math.floor(Date.now() / 1000) - 30; // 30 seconds ago
    vi.mocked(mockAuthAdmin.verifyIdToken).mockResolvedValue({
      auth_time: recentAuthTime,
      uid: 'test-uid',
    } as any);

    vi.mocked(mockAuthAdmin.createSessionCookie).mockResolvedValue('session-cookie-value');

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'valid-token' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Check if cookie was set
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain('__session');
    expect(setCookieHeader).toContain('HttpOnly');
    // Case-insensitive check for SameSite
    expect(setCookieHeader?.toLowerCase()).toContain('samesite=strict');
  });

  it('should handle Firebase verification errors', async () => {
    const mockAuthAdmin = getAuthAdmin();
    
    vi.mocked(mockAuthAdmin.verifyIdToken).mockRejectedValue(
      new Error('Invalid token')
    );

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'invalid-token' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Failed to create session.');
  });
});

describe('DELETE /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear cookie and return success', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'DELETE',
      headers: {
        cookie: '__session=existing-session-cookie',
      },
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Check if cookie was cleared
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain('__session=');
    // Check for either Max-Age=0 or Expires in past
    const hasCookieDeletion = setCookieHeader?.includes('Max-Age=0') || 
                              setCookieHeader?.includes('Expires=Thu, 01 Jan 1970');
    expect(hasCookieDeletion).toBe(true);
  });

  it('should revoke tokens if session exists', async () => {
    const mockAuthAdmin = getAuthAdmin();
    
    vi.mocked(mockAuthAdmin.verifySessionCookie).mockResolvedValue({
      sub: 'user-uid-123',
    } as any);

    const mockRevokeTokens = vi.mocked(mockAuthAdmin.revokeRefreshTokens);

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'DELETE',
      headers: {
        cookie: '__session=valid-session-cookie',
      },
    });

    await DELETE(request);

    expect(mockRevokeTokens).toHaveBeenCalledWith('user-uid-123');
  });

  it('should still succeed even if token revocation fails', async () => {
    const mockAuthAdmin = getAuthAdmin();
    
    vi.mocked(mockAuthAdmin.verifySessionCookie).mockRejectedValue(
      new Error('Session verification failed')
    );

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'DELETE',
      headers: {
        cookie: '__session=invalid-cookie',
      },
    });

    const response = await DELETE(request);
    const data = await response.json();

    // Should still return success (idempotent operation)
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
