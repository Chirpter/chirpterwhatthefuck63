// src/features/auth/__tests__/auth-flow.integration.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { UserProvider } from '@/contexts/user-context';
import LoginView from '@/features/auth/components/LoginView';
import { onAuthStateChanged, signInWithEmailAndPassword, type NextOrObserver, type User } from 'firebase/auth';

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

// Mock fetch for session API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component to expose auth state
const AuthStateDisplay = () => {
  const { authUser, loading, isSigningIn, error } = useAuth();
  return (
    <div>
      <div data-testid="auth-user">{authUser?.uid || 'null'}</div>
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="signing-in">{isSigningIn ? 'true' : 'false'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
    </div>
  );
};

describe('Auth Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    
    // Mock document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to correctly invoke the onAuthStateChanged callback
  const callObserver = (observer: NextOrObserver<User>, user: User | null) => {
    if (typeof observer === 'function') {
        observer(user);
    } else if (observer.next) {
        observer.next(user);
    }
  };

  describe('Initial Auth State', () => {
    it('should start in loading state', () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        // Don't call callback immediately - simulate loading
        return () => {};
      });

      render(
        <AuthProvider>
          <AuthStateDisplay />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
      expect(screen.getByTestId('auth-user')).toHaveTextContent('null');
    });

    it('should resolve to authenticated state when user exists', async () => {
      const mockUser = {
        uid: 'test-123',
        email: 'test@example.com',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      vi.mocked(onAuthStateChanged).mockImplementation((auth, observer) => {
        setTimeout(() => callObserver(observer, mockUser as any), 0);
        return () => {};
      });

      render(
        <AuthProvider>
          <AuthStateDisplay />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
        expect(screen.getByTestId('auth-user')).toHaveTextContent('test-123');
      });
    });

    it('should resolve to unauthenticated state when no user', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observer) => {
        setTimeout(() => callObserver(observer, null), 0);
        return () => {};
      });

      render(
        <AuthProvider>
          <AuthStateDisplay />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
        expect(screen.getByTestId('auth-user')).toHaveTextContent('null');
      });
    });
  });

  describe('Login Flow', () => {
    it('should handle successful email login with proper state transitions', async () => {
      const mockUser = {
        uid: 'test-123',
        email: 'test@example.com',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      // Setup: Initially no user
      let authCallback: NextOrObserver<User>;
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observer) => {
        authCallback = observer;
        setTimeout(() => callObserver(observer, null), 0);
        return () => {};
      });

      // Mock successful sign in
      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser as any,
      } as any);

      // Mock successful session cookie creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Simulate cookie being set
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '__session=test-cookie',
      });

      const TestComponent = () => {
        const { signInWithEmail, isSigningIn, error } = useAuth();
        return (
          <div>
            <button onClick={() => signInWithEmail('test@example.com', 'password')}>
              Sign In
            </button>
            <div data-testid="signing-in">{isSigningIn ? 'true' : 'false'}</div>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initial auth state
      await waitFor(() => {
        expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
      });

      // Trigger sign in
      fireEvent.click(screen.getByText('Sign In'));

      // Should enter signing-in state
      await waitFor(() => {
        expect(screen.getByTestId('signing-in')).toHaveTextContent('true');
      });

      // Simulate Firebase auth state change after successful login
      await waitFor(() => {
        if (authCallback) callObserver(authCallback, mockUser as any);
      });

      // Should complete sign in
      await waitFor(() => {
        expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });

      // Verify session API was called
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/session',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ idToken: 'fake-token' }),
        })
      );

      // Verify navigation
      expect(mockPush).toHaveBeenCalledWith('/library/book');
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('should handle login failure with proper error message', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observer) => {
        setTimeout(() => callObserver(observer, null), 0);
        return () => {};
      });

      vi.mocked(signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/invalid-credential',
      });

      const TestComponent = () => {
        const { signInWithEmail, error } = useAuth();
        return (
          <div>
            <button onClick={() => signInWithEmail('wrong@example.com', 'wrong')}>
              Sign In
            </button>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });

      fireEvent.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password');
      });

      // Should not navigate on error
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should prevent concurrent login attempts', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observer) => {
        setTimeout(() => callObserver(observer, null), 0);
        return () => {};
      });

      const mockUser = {
        uid: 'test-123',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      let resolveSignIn: any;
      vi.mocked(signInWithEmailAndPassword).mockImplementation(() => 
        new Promise(resolve => {
          resolveSignIn = () => resolve({ user: mockUser } as any);
        })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '__session=test-cookie',
      });

      const TestComponent = () => {
        const { signInWithEmail, isSigningIn } = useAuth();
        return (
          <div>
            <button onClick={() => signInWithEmail('test@example.com', 'password')}>
              Sign In
            </button>
            <div data-testid="signing-in">{isSigningIn ? 'true' : 'false'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
      });

      const signInButton = screen.getByText('Sign In');

      // First click
      fireEvent.click(signInButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('signing-in')).toHaveTextContent('true');
      });

      // Second click while first is in progress
      fireEvent.click(signInButton);

      // Should still only call Firebase once
      expect(vi.mocked(signInWithEmailAndPassword)).toHaveBeenCalledTimes(1);

      // Resolve first login
      resolveSignIn();

      await waitFor(() => {
        expect(screen.getByTestId('signing-in')).toHaveTextContent('false');
      }, { timeout: 3000 });
    });
  });

  describe('Logout Flow', () => {
    it('should handle successful logout', async () => {
      const mockUser = {
        uid: 'test-123',
        email: 'test@example.com',
      };

      let authCallback: NextOrObserver<User>;
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observer) => {
        authCallback = observer;
        setTimeout(() => callObserver(observer, mockUser as any), 0);
        return () => {};
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const TestComponent = () => {
        const { logout, authUser } = useAuth();
        return (
          <div>
            <div data-testid="auth-user">{authUser?.uid || 'null'}</div>
            <button onClick={logout}>Logout</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initial authenticated state
      await waitFor(() => {
        expect(screen.getByTestId('auth-user')).toHaveTextContent('test-123');
      });

      // Trigger logout
      fireEvent.click(screen.getByText('Logout'));

      // Simulate auth state change
      await waitFor(() => {
        if (authCallback) callObserver(authCallback, null);
      });

      // Verify session API was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/auth/session',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });

      // Verify navigation
      expect(mockPush).toHaveBeenCalledWith('/login?reason=logged_out');
    });
  });

  describe('Session Cookie Edge Cases', () => {
    it('should retry session cookie creation on failure', async () => {
      const mockUser = {
        uid: 'test-123',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      vi.mocked(onAuthStateChanged).mockImplementation((auth, observer) => {
        setTimeout(() => callObserver(observer, null), 0);
        return () => {};
      });

      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser as any,
      } as any);

      // First two attempts fail, third succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '__session=test-cookie',
      });

      const TestComponent = () => {
        const { signInWithEmail, error } = useAuth();
        return (
          <div>
            <button onClick={() => signInWithEmail('test@example.com', 'password')}>
              Sign In
            </button>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });

      fireEvent.click(screen.getByText('Sign In'));

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(mockPush).toHaveBeenCalledWith('/library/book');
      }, { timeout: 3000 });
    });

    it('should show error after max retries exceeded', async () => {
      const mockUser = {
        uid: 'test-123',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      vi.mocked(onAuthStateChanged).mockImplementation((auth, observer) => {
        setTimeout(() => callObserver(observer, null), 0);
        return () => {};
      });

      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser as any,
      } as any);

      // All attempts fail
      mockFetch.mockResolvedValue({ ok: false });

      const TestComponent = () => {
        const { signInWithEmail, error } = useAuth();
        return (
          <div>
            <button onClick={() => signInWithEmail('test@example.com', 'password')}>
              Sign In
            </button>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });

      fireEvent.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Could not create a server session');
      }, { timeout: 3000 });

      // Should not navigate on error
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
