// src/app/api/auth/session/__tests__/route.test.ts - PRODUCTION READY (FIXED)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, DELETE } from '../route';
import { NextRequest } from 'next/server';

// ✅ FIX: Create mocks before importing
const mockVerifyIdToken = vi.fn();
const mockCreateSessionCookie = vi.fn();
const mockVerifySessionCookie = vi.fn();
const mockRevokeRefreshTokens = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  getAuthAdmin: vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
    createSessionCookie: mockCreateSessionCookie,
    verifySessionCookie: mockVerifySessionCookie,
    revokeRefreshTokens: mockRevokeRefreshTokens,
  })),
}));

describe('POST /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyIdToken.mockReset();
    mockCreateSessionCookie.mockReset();
    mockVerifySessionCookie.mockReset();
    mockRevokeRefreshTokens.mockReset();
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
    // ✅ FIX: Mock token with proper auth_time
    const oldAuthTime = Math.floor(Date.now() / 1000) - (10 * 60); // 10 minutes ago
    mockVerifyIdToken.mockResolvedValue({
      auth_time: oldAuthTime,
      uid: 'test-uid',
      aud: 'test-project',
      iat: oldAuthTime,
      exp: oldAuthTime + 3600,
      iss: 'test-issuer',
      sub: 'test-uid',
    });

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
    // ✅ FIX: Mock recent sign-in with complete token
    const recentAuthTime = Math.floor(Date.now() / 1000) - 30; // 30 seconds ago
    mockVerifyIdToken.mockResolvedValue({
      auth_time: recentAuthTime,
      uid: 'test-uid',
      aud: 'test-project',
      iat: recentAuthTime,
      exp: recentAuthTime + 3600,
      iss: 'test-issuer',
      sub: 'test-uid',
    });

    mockCreateSessionCookie.mockResolvedValue('session-cookie-value');

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
    expect(setCookieHeader?.toLowerCase()).toContain('samesite=strict');
  });

  it('should handle Firebase verification errors', async () => {
    mockVerifyIdToken.mockRejectedValue(
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
    mockVerifyIdToken.mockReset();
    mockCreateSessionCookie.mockReset();
    mockVerifySessionCookie.mockReset();
    mockRevokeRefreshTokens.mockReset();
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
    const hasCookieDeletion = setCookieHeader?.includes('Max-Age=0') || 
                              setCookieHeader?.includes('Expires=Thu, 01 Jan 1970');
    expect(hasCookieDeletion).toBe(true);
  });

  it('should revoke tokens if session exists', async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: 'user-uid-123',
      uid: 'user-uid-123',
      aud: 'test-project',
      iat: Date.now(),
      exp: Date.now() + 3600,
      iss: 'test-issuer',
    });

    mockRevokeRefreshTokens.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/auth/session', {
      method: 'DELETE',
      headers: {
        cookie: '__session=valid-session-cookie',
      },
    });

    const response = await DELETE(request);

    // ✅ FIX: Response should be immediate
    expect(response.status).toBe(200);

    // ✅ FIX: Wait for background revocation to complete
    await vi.waitFor(() => {
      expect(mockRevokeRefreshTokens).toHaveBeenCalledWith('user-uid-123');
    }, { timeout: 500 });
  });

  it('should still succeed even if token revocation fails', async () => {
    mockVerifySessionCookie.mockRejectedValue(
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