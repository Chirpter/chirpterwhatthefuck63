// src/__tests__/middleware.test.ts - PRODUCTION READY
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../middleware';

// Mock Firebase Admin
const mockVerifySessionCookie = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  getAuthAdmin: vi.fn(() => ({
    verifySessionCookie: mockVerifySessionCookie,
  })),
}));

// Helper to create NextRequest
function createRequest(pathname: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost:3000${pathname}`;
  const request = new NextRequest(url);
  
  // Set cookies
  Object.entries(cookies).forEach(([name, value]) => {
    request.cookies.set(name, value);
  });
  
  return request;
}

describe('Middleware Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Public Routes', () => {
    it('should allow access to landing page without auth', async () => {
      const request = createRequest('/');
      const response = await middleware(request);
      
      expect(response).toBeDefined();
      expect(response.status).not.toBe(307); // Not a redirect
    });

    it('should allow access to login page without auth', async () => {
      const request = createRequest('/login');
      const response = await middleware(request);
      
      expect(response).toBeDefined();
      expect(response.status).not.toBe(307);
    });

    it('should redirect authenticated user away from login page', async () => {
      mockVerifySessionCookie.mockResolvedValue({ uid: 'test-user' });
      
      const request = createRequest('/login', { __session: 'valid-cookie' });
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/library/book');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect unauthenticated user to login', async () => {
      const request = createRequest('/library/book');
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });

    it('should include next parameter in redirect URL', async () => {
      const request = createRequest('/profile');
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('next=%2Fprofile');
    });

    it('should allow authenticated user to access protected routes', async () => {
      mockVerifySessionCookie.mockResolvedValue({ uid: 'test-user' });
      
      const request = createRequest('/library/book', { __session: 'valid-cookie' });
      const response = await middleware(request);
      
      expect(response.status).not.toBe(307);
    });
  });

  describe('Session Cookie Validation', () => {
    it('should accept valid session cookie', async () => {
      mockVerifySessionCookie.mockResolvedValue({ uid: 'test-user' });
      
      const request = createRequest('/library/book', { __session: 'valid-cookie' });
      const response = await middleware(request);
      
      expect(mockVerifySessionCookie).toHaveBeenCalledWith('valid-cookie', true);
      expect(response.status).not.toBe(307);
    });

    it('should reject expired session cookie', async () => {
      mockVerifySessionCookie.mockRejectedValue({
        code: 'auth/session-cookie-expired',
      });
      
      const request = createRequest('/library/book', { __session: 'expired-cookie' });
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('reason=session_expired');
    });

    it('should delete cookie for permanent auth errors', async () => {
      mockVerifySessionCookie.mockRejectedValue({
        code: 'auth/id-token-revoked',
      });
      
      const request = createRequest('/library/book', { __session: 'revoked-cookie' });
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      
      // Check if cookie is deleted
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('__session=');
      // Check for either Max-Age=0 or Expires in past
      const hasCookieDeletion = setCookie?.includes('Max-Age=0') || 
                                setCookie?.includes('Expires=Thu, 01 Jan 1970');
      expect(hasCookieDeletion).toBe(true);
    });
  });

  describe('Temporary Error Handling', () => {
    it('should retry on temporary network errors', async () => {
      mockVerifySessionCookie
        .mockRejectedValueOnce({ code: 'unavailable' })
        .mockResolvedValueOnce({ uid: 'test-user' });
      
      const request = createRequest('/library/book', { __session: 'valid-cookie' });
      const response = await middleware(request);
      
      // Should succeed after retry
      expect(mockVerifySessionCookie).toHaveBeenCalledTimes(2);
      expect(response.status).not.toBe(307);
    });

    it('should allow request through on temporary error without deleting cookie', async () => {
      mockVerifySessionCookie.mockRejectedValue({
        code: 'auth/network-request-failed',
      });
      
      const request = createRequest('/library/book', { __session: 'valid-cookie' });
      const response = await middleware(request);
      
      // Should not redirect (allows request through)
      expect(response.status).not.toBe(307);
      
      // Should not delete cookie
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toBeFalsy();
    });

    it('should allow through after max retries on persistent temporary errors', async () => {
      mockVerifySessionCookie.mockRejectedValue({ code: 'unavailable' });
      
      const request = createRequest('/library/book', { __session: 'valid-cookie' });
      const response = await middleware(request);
      
      // Should have attempted max retries
      expect(mockVerifySessionCookie).toHaveBeenCalledTimes(2); // maxRetries = 2
      
      // Should allow through without redirect (temporary error handling)
      expect(response.status).not.toBe(307);
      
      // Should not delete cookie
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toBeFalsy();
    });
  });

  describe('API Routes', () => {
    it('should not interfere with API routes', async () => {
      const request = createRequest('/api/some-endpoint');
      const response = await middleware(request);
      
      expect(response.status).not.toBe(307);
      expect(mockVerifySessionCookie).not.toHaveBeenCalled();
    });

    it('should allow unauthenticated access to API routes', async () => {
      const request = createRequest('/api/auth/session');
      const response = await middleware(request);
      
      expect(response.status).not.toBe(307);
    });
  });

  describe('Error Reason Codes', () => {
    const errorTests = [
      { code: 'auth/id-token-expired', reason: 'session_expired' },
      { code: 'auth/session-cookie-expired', reason: 'session_expired' },
      { code: 'auth/id-token-revoked', reason: 'session_revoked' },
      { code: 'auth/session-cookie-revoked', reason: 'session_revoked' },
      { code: 'auth/argument-error', reason: 'invalid_session' },
      { code: 'unknown-error', reason: 'auth_error' },
    ];

    errorTests.forEach(({ code, reason }) => {
      it(`should set reason=${reason} for error code ${code}`, async () => {
        mockVerifySessionCookie.mockRejectedValue({ code });
        
        const request = createRequest('/library/book', { __session: 'bad-cookie' });
        const response = await middleware(request);
        
        expect(response.status).toBe(307);
        const location = response.headers.get('location');
        expect(location).toContain(`reason=${reason}`);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing cookie gracefully', async () => {
      const request = createRequest('/library/book');
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      expect(mockVerifySessionCookie).not.toHaveBeenCalled();
    });

    it('should handle malformed cookie', async () => {
      mockVerifySessionCookie.mockRejectedValue({
        code: 'auth/argument-error',
      });
      
      const request = createRequest('/library/book', { __session: 'malformed' });
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('reason=invalid_session');
    });

    it('should not process static file requests', async () => {
      const request = createRequest('/favicon.ico');
      const response = await middleware(request);
      
      // Should be filtered out by matcher config
      expect(mockVerifySessionCookie).not.toHaveBeenCalled();
    });
  });
});