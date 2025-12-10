// src/features/auth/__tests__/auth-flow-verification.test.tsx
// ✅ Comprehensive verification test for fixed auth flow

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';

// Mock Firebase Auth
vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    getAuth: vi.fn(() => ({})),
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    GoogleAuthProvider: vi.fn(),
  };
});

// Mock Next.js router
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

// Test component
const TestAuthComponent = () => {
  const { authUser, loading, isSigningIn, error, signInWithEmail } = useAuth();
  
  return (
    <div>
      <div data-testid="auth-user">{authUser?.uid || 'null'}</div>
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="signing-in">{isSigningIn ? 'true' : 'false'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <button onClick={() => signInWithEmail('test@example.com', 'password')}>
        Sign In
      </button>
    </div>
  );
};

describe('Auth Flow Verification Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset cookie
    document.cookie = '';
    
    // Mock successful fetch by default
    global.fetch = vi.fn((url: string | URL | Request, options?: RequestInit) => {
      const urlString = url instanceof URL ? url.toString() : 
                       url instanceof Request ? url.url : 
                       url;
      
      if (urlString.includes('/api/auth/session') && options?.method === 'POST') {
        // Simulate cookie being set
        setTimeout(() => {
          document.cookie = '__session=test-session-cookie; path=/';
        }, 50);
        
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
          headers: new Headers(),
        } as Response);
      }
      
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers(),
      } as Response);
    }) as any;
  });

  it('✅ should handle auth state correctly', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
      setTimeout(() => callback(mockUser), 0);
      return () => {};
    });

    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );

    // Should start loading
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');

    // Should resolve to authenticated
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      expect(screen.getByTestId('auth-user')).toHaveTextContent('test-123');
    });
  });

  it('✅ should prevent concurrent sign-in operations', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
      setTimeout(() => callback(null), 0);
      return () => {};
    });

    // Mock slow sign-in
    let resolveSignIn: any;
    vi.mocked(signInWithEmailAndPassword).mockImplementation(() => 
      new Promise(resolve => {
        resolveSignIn = () => resolve({ user: mockUser } as any);
      })
    );

    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    const signInButton = screen.getByText('Sign In');

    // Click multiple times
    fireEvent.click(signInButton);
    fireEvent.click(signInButton);
    fireEvent.click(signInButton);

    // ✅ Should only call Firebase once
    expect(vi.mocked(signInWithEmailAndPassword)).toHaveBeenCalledTimes(1);

    // Complete the sign-in
    resolveSignIn();

    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
    }, { timeout: 3000 });
  });

  it('✅ should verify session cookie properly', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
      setTimeout(() => callback(null), 0);
      return () => {};
    });

    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser as any,
    } as any);

    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    fireEvent.click(screen.getByText('Sign In'));

    // ✅ Should verify cookie was set
    await waitFor(() => {
      expect(document.cookie).toContain('__session=');
      expect(mockPush).toHaveBeenCalledWith('/library/book');
      expect(mockRefresh).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('✅ should retry on session cookie failure', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
      setTimeout(() => callback(null), 0);
      return () => {};
    });

    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser as any,
    } as any);

    // First two attempts fail, third succeeds
    let attempts = 0;
    global.fetch = vi.fn((url: string | URL | Request, options?: RequestInit) => {
      attempts++;
      const urlString = url instanceof URL ? url.toString() : 
                       url instanceof Request ? url.url : 
                       url;
      
      if (urlString.includes('/api/auth/session') && options?.method === 'POST') {
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: 'temporary error' }),
            headers: new Headers(),
          } as Response);
        }
        
        setTimeout(() => {
          document.cookie = '__session=test-cookie; path=/';
        }, 50);
        
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
          headers: new Headers(),
        } as Response);
      }
      
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers(),
      } as Response);
    }) as any;

    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    fireEvent.click(screen.getByText('Sign In'));

    // ✅ Should eventually succeed after retries
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(mockPush).toHaveBeenCalledWith('/library/book');
    }, { timeout: 5000 });
  });

  it('✅ should show error after max retries', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
      setTimeout(() => callback(null), 0);
      return () => {};
    });

    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser as any,
    } as any);

    // All attempts fail
    global.fetch = vi.fn(() => 
      Promise.resolve({
        ok: false,
        json: async () => ({ error: 'server error' }),
        headers: new Headers(),
      } as Response)
    ) as any;

    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    fireEvent.click(screen.getByText('Sign In'));

    // ✅ Should show error after max retries
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Could not create a server session');
    }, { timeout: 5000 });
  });
});