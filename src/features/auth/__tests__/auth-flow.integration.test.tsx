// src/features/auth/__tests__/auth-flow.integration.test.tsx - FIXED VERSION
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { setupLocationMock } from '@/lib/test-utils';

vi.mock('@/lib/firebase', () => ({
  auth: {},
  app: {},
  db: {},
  storage: {},
  functions: {},
}));

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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

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
    
    global.fetch = vi.fn((url: string | URL | Request, options?: RequestInit) => {
      const urlString = url instanceof URL ? url.toString() : 
                       url instanceof Request ? url.url : 
                       url;
      
      if (urlString.includes('/api/auth/session') && options?.method === 'POST') {
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

  it('should complete full sign-in flow', async () => {
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

    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('true');
    });

    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      expect(locationMock.mockNavigate).toHaveBeenCalledWith('/library/book');
    }, { timeout: 2000 });
  });

  it('should handle cookie creation timeout gracefully', async () => {
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

    global.fetch = vi.fn(() => 
      Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
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

    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
    }, { timeout: 3000 });

    await waitFor(() => {
      const errorText = screen.getByTestId('error').textContent;
      expect(errorText).toContain('Could not create a server session');
    }, { timeout: 1000 });

    expect(locationMock.mockNavigate).not.toHaveBeenCalled();
  }, 5000);

  // ✅ FIXED: Test should succeed after exactly 2 attempts (within maxRetries=2)
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

    let attempts = 0;
    global.fetch = vi.fn(() => {
      attempts++;
      // ✅ FIXED: Fail on attempt 1, succeed on attempt 2
      if (attempts < 2) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'temporary error' }),
          headers: new Headers(),
        } as Response);
      }
      
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

    await waitFor(() => {
      expect(attempts).toBe(2);
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

    fireEvent.click(signInButton);
    fireEvent.click(signInButton);
    fireEvent.click(signInButton);

    expect(vi.mocked(signInWithEmailAndPassword)).toHaveBeenCalledTimes(1);

    resolveSignIn();

    await waitFor(() => {
      expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
    }, { timeout: 2000 });
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

    await waitFor(() => {
      const errorText = screen.getByTestId('error').textContent;
      expect(errorText).toContain('Could not create a server session');
    }, { timeout: 3000 });
  }, 5000);
});