// src/features/auth/__tests__/auth-flow.integration.test.tsx - FIXED VERSION
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { setupLocationMock } from '@/lib/test-utils';


// ✅ FIX: Mock Firebase config first
vi.mock('@/lib/firebase', () => ({
  auth: {},
  app: {},
  db: {},
  storage: {},
  functions: {},
}));

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
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
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

describe('Auth Flow Complete Integration Tests', () => {
  let locationMock: ReturnType<typeof setupLocationMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = '';
    locationMock = setupLocationMock();
    
    // ✅ FIX: Better mock with proper cookie simulation
    global.fetch = vi.fn((url: string | URL | Request, options?: RequestInit) => {
      const urlString = url instanceof URL ? url.toString() : 
                       url instanceof Request ? url.url : 
                       url;
      
      if (urlString.includes('/api/auth/session') && options?.method === 'POST') {
        // Simulate cookie being set asynchronously
        setTimeout(() => {
          document.cookie = '__session=test-session-cookie-value-12345; path=/';
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

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    locationMock.cleanup();
  });

  it('should complete full sign-in flow with cookie polling', async () => {
    const mockUser = {
      uid: 'test-123',
      email: 'test@example.com',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    } as Partial<FirebaseUser>;

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        setTimeout(() => callback(null), 0);
      } else {
        setTimeout(() => (callback as any).next(null), 0);
      }
      return () => {};
    });

    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser as FirebaseUser,
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

    // Should enter signing-in state
    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('true');
    });

    // Should complete sign-in and navigate
    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    }, { timeout: 3000 });

    // Verify cookie was set
    expect(document.cookie).toContain('__session=');
    expect(document.cookie).toContain('test-session-cookie-value-12345');
    
    // Verify navigation
    expect(locationMock.mockNavigate).toHaveBeenCalledWith('/library/book');
  });

  it('should handle cookie polling timeout gracefully', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        setTimeout(() => callback(null), 0);
      } else {
        setTimeout(() => (callback as any).next(null), 0);
      }
      return () => {};
    });

    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser as any,
    } as any);

    // ✅ FIX: Mock fetch that succeeds but doesn't set cookie
    // Note: document.cookie is NOT set, so waitForCookie will timeout
    global.fetch = vi.fn(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
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

    // Wait for signing-in to complete (will take ~2s for cookie polling + retries)
    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
    }, { timeout: 8000 });

    // Then check error message
    await waitFor(() => {
      const errorText = screen.getByTestId('error').textContent;
      expect(errorText).toContain('Could not create a server session');
    }, { timeout: 1000 });

    // Should not navigate on error
    expect(locationMock.mockNavigate).not.toHaveBeenCalled();
  }, 10000);

  it('should retry session creation on failure', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        setTimeout(() => callback(null), 0);
      } else {
        setTimeout(() => (callback as any).next(null), 0);
      }
      return () => {};
    });

    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser as any,
    } as any);

    // First two attempts fail, third succeeds with cookie
    let attempts = 0;
    global.fetch = vi.fn(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'temporary error' }),
          headers: new Headers(),
        } as Response);
      }
      
      setTimeout(() => {
        document.cookie = '__session=test-cookie; path=/';
      }, 50);
      
      return Promise.resolve({
        ok: true,
        status: 200,
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

    // Should eventually succeed after retries (3 attempts + backoff = ~1s)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(locationMock.mockNavigate).toHaveBeenCalledWith('/library/book');
    }, { timeout: 3000 });
  }, 5000);

  it('should prevent concurrent sign-in operations', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        setTimeout(() => callback(null), 0);
      } else {
        setTimeout(() => (callback as any).next(null), 0);
      }
      return () => {};
    });

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

    // Click multiple times rapidly
    fireEvent.click(signInButton);
    fireEvent.click(signInButton);
    fireEvent.click(signInButton);

    // Should only call Firebase once
    expect(vi.mocked(signInWithEmailAndPassword)).toHaveBeenCalledTimes(1);

    // Complete the sign-in
    resolveSignIn();

    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
    }, { timeout: 5000 });
  });

  it('should handle network errors with proper error message', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        setTimeout(() => callback(null), 0);
      } else {
        setTimeout(() => (callback as any).next(null), 0);
      }
      return () => {};
    });

    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser as any,
    } as any);

    // ✅ FIX: Mock network error
    global.fetch = vi.fn(() => 
      Promise.reject(new Error('Network error'))
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

    // Should show session error (not generic error)
    await waitFor(() => {
      const errorText = screen.getByTestId('error').textContent;
      expect(errorText).toContain('Could not create a server session');
    }, { timeout: 2000 });
  }, 6000);
});
