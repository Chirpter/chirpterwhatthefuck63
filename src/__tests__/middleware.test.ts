// src/__tests__/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Mock Firebase Admin SDK
vi.mock('@/lib/firebase-admin', () => ({
  getAuthAdmin: vi.fn(() => ({
    verifySessionCookie: vi.fn(),
  })),
}));

// We need to await the import because of the top-level vi.mock
const { getAuthAdmin } = await import('@/lib/firebase-admin');

const createMockRequest = (pathname: string, sessionCookie?: string): NextRequest => {
  const url = `http://localhost:3000${pathname}`;
  const request = new NextRequest(url);
  if (sessionCookie) {
    request.cookies.set('__session', sessionCookie);
  }
  return request;
};

describe('Middleware', () => {
  let mockAuthAdmin: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAdmin = getAuthAdmin();
  });

  describe('Unauthenticated User', () => {
    it('should redirect to /login when accessing a protected route', async () => {
      const request = createMockRequest('/library');
      const response = await middleware(request);
      
      expect(response.status).toBe(307); // Redirect status
      expect(response.headers.get('location')).toContain('/login');
    });

    it('should add the original path to the `next` query param on redirect', async () => {
        const request = createMockRequest('/profile');
        const response = await middleware(request);

        expect(response.headers.get('location')).toBe('http://localhost:3000/login?next=%2Fprofile');
    });

    it('should allow access to the public landing page', async () => {
      const request = createMockRequest('/');
      const response = await middleware(request);

      // NextResponse.next() doesn't have a specific status, we check that it's not a redirect
      expect(response.status).not.toBe(307);
    });

    it('should allow access to the login page', async () => {
      const request = createMockRequest('/login');
      const response = await middleware(request);
      
      expect(response.status).not.toBe(307);
    });
  });

  describe('Authenticated User', () => {
    beforeEach(() => {
      // Mock successful verification for all tests in this block
      vi.mocked(mockAuthAdmin.verifySessionCookie).mockResolvedValue({ uid: 'test-uid' });
    });

    it('should allow access to a protected route', async () => {
      const request = createMockRequest('/library', 'valid-session-cookie');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      // verifySessionCookie should have been called
      expect(mockAuthAdmin.verifySessionCookie).toHaveBeenCalledWith('valid-session-cookie', true);
    });

    it('should redirect from the landing page to the app', async () => {
      const request = createMockRequest('/', 'valid-session-cookie');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/library/book');
    });

    it('should redirect from the login page to the app', async () => {
      const request = createMockRequest('/login', 'valid-session-cookie');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/library/book');
    });
  });

  describe('Session Error Handling', () => {
    it('should redirect to login if session cookie is expired', async () => {
      vi.mocked(mockAuthAdmin.verifySessionCookie).mockRejectedValue({
        code: 'auth/session-cookie-expired',
      });
      
      const request = createMockRequest('/profile', 'expired-cookie');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('reason=session_expired');

      // Should clear the invalid cookie
      expect(response.cookies.get('__session')?.value).toBe('');
    });

    it('should not delete cookie for temporary network errors', async () => {
        vi.mocked(mockAuthAdmin.verifySessionCookie).mockRejectedValue({
            code: 'unavailable', // A temporary gRPC error
        });
        
        const request = createMockRequest('/profile', 'good-cookie-bad-network');
        const response = await middleware(request);
  
        expect(response.status).toBe(307);
        const location = response.headers.get('location');
        expect(location).toContain('/login');
        expect(location).toContain('reason=network_error');
  
        // Crucially, the cookie should NOT be deleted
        expect(response.cookies.get('__session')).toBeUndefined();
    });
  });

  describe('Ignored Routes', () => {
    it('should ignore API routes', async () => {
      const request = createMockRequest('/api/some/endpoint');
      const response = await middleware(request);
      
      expect(response.status).not.toBe(307);
      // Firebase verify should not be called for API routes
      expect(mockAuthAdmin.verifySessionCookie).not.toHaveBeenCalled();
    });

    it('should ignore static file routes like _next/static', async () => {
      const request = createMockRequest('/_next/static/css/styles.css');
      const response = await middleware(request);

      // This isn't a perfect test since middleware config does the actual ignoring,
      // but it ensures our logic doesn't interfere if it were to run.
      expect(response.status).not.toBe(307);
      expect(mockAuthAdmin.verifySessionCookie).not.toHaveBeenCalled();
    });

     it('should ignore image file routes', async () => {
      const request = createMockRequest('/some/image.png');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(mockAuthAdmin.verifySessionCookie).not.toHaveBeenCalled();
    });
  });
});
