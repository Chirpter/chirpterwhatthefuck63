// src/contexts/__tests__/auth-context.test.tsx
// Unit tests cho AuthContext logic - CẢI TIẾN
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-context';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

// Mock Firebase Auth with proper types
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, observerOrNext) => {
    // Return unsubscribe function
    return () => {};
  }),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  auth: {},
}));

// Mock Next.js router
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock fetch for session API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component to access context
const TestComponent = () => {
  const { authUser, loading, error, isSigningIn } = useAuth();
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="user">{authUser ? authUser.uid : 'no-user'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="signing-in">{isSigningIn ? 'signing-in' : 'not-signing-in'}</div>
    </div>
  );
};

describe('AuthContext Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    
    // Reset document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with loading state', () => {
      // Mock onAuthStateChanged to never call callback (simulating loading)
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observerOrNext) => {
        return () => {}; // Return unsubscribe function
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    it('should set authUser when Firebase returns user', async () => {
      const mockUser: Partial<FirebaseUser> = {
        uid: 'test-uid-123',
        email: 'test@example.com',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      // Mock onAuthStateChanged to immediately call callback with user
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observerOrNext) => {
        if (typeof observerOrNext === 'function') {
          observerOrNext(mockUser as FirebaseUser);
        }
        return () => {};
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
        expect(screen.getByTestId('user')).toHaveTextContent('test-uid-123');
      });
    });

    it('should handle null user (logged out)', async () => {
      // Mock onAuthStateChanged to call callback with null
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observerOrNext) => {
        if (typeof observerOrNext === 'function') {
          observerOrNext(null);
        }
        return () => {};
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
        expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle auth/invalid-credential error correctly', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observerOrNext) => {
        if (typeof observerOrNext === 'function') {
          observerOrNext(null);
        }
        return () => {};
      });

      const TestWithSignIn = () => {
        const { signInWithEmail, error } = useAuth();
        return (
          <div>
            <button onClick={() => signInWithEmail('test@test.com', 'pass')}>
              Sign In
            </button>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      vi.mocked(signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/invalid-credential',
      });

      render(
        <AuthProvider>
          <TestWithSignIn />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });

      const signInButton = screen.getByText('Sign In');
      await act(async () => {
        signInButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password');
      });
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observerOrNext) => {
        if (typeof observerOrNext === 'function') {
          observerOrNext(null);
        }
        return () => {};
      });

      const TestWithSignIn = () => {
        const { signInWithEmail, error } = useAuth();
        return (
          <div>
            <button onClick={() => signInWithEmail('test@test.com', 'pass')}>
              Sign In
            </button>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      vi.mocked(signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/network-request-failed',
      });

      render(
        <AuthProvider>
          <TestWithSignIn />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });

      const signInButton = screen.getByText('Sign In');
      await act(async () => {
        signInButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(/Network error/);
      });
    });
  });

  describe('State Management', () => {
    it('should clear error when clearAuthError is called', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observerOrNext) => {
        if (typeof observerOrNext === 'function') {
          observerOrNext(null);
        }
        return () => {};
      });

      const TestWithClearError = () => {
        const { error, clearAuthError } = useAuth();
        return (
          <div>
            <div data-testid="error">{error || 'no-error'}</div>
            <button onClick={clearAuthError}>Clear Error</button>
          </div>
        );
      };

      const { rerender } = render(
        <AuthProvider>
          <TestWithClearError />
        </AuthProvider>
      );

      // Manually set error by triggering failed sign in
      const TestWithSignIn = () => {
        const { signInWithEmail, error, clearAuthError } = useAuth();
        return (
          <div>
            <button onClick={() => signInWithEmail('test@test.com', 'pass')}>
              Sign In
            </button>
            <div data-testid="error">{error || 'no-error'}</div>
            <button onClick={clearAuthError}>Clear Error</button>
          </div>
        );
      };

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      vi.mocked(signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/invalid-credential',
      });

      rerender(
        <AuthProvider>
          <TestWithSignIn />
        </AuthProvider>
      );

      const signInButton = screen.getByText('Sign In');
      await act(async () => {
        signInButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).not.toHaveTextContent('no-error');
      });

      const clearButton = screen.getByText('Clear Error');
      await act(async () => {
        clearButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });
    });
  });

  describe('Concurrent Operation Protection', () => {
    it('should prevent multiple concurrent sign-in operations', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observerOrNext) => {
        if (typeof observerOrNext === 'function') {
          observerOrNext(null);
        }
        return () => {};
      });

      const mockUser: Partial<FirebaseUser> = {
        uid: 'test-uid',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      
      let resolveSignIn: any;
      const signInPromise = new Promise<any>(resolve => {
        resolveSignIn = resolve;
      });

      vi.mocked(signInWithEmailAndPassword).mockReturnValue(signInPromise);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '__session=test-cookie',
      });

      const TestWithSignIn = () => {
        const { signInWithEmail } = useAuth();
        return (
          <button onClick={() => signInWithEmail('test@test.com', 'pass')}>
            Sign In
          </button>
        );
      };

      render(
        <AuthProvider>
          <TestWithSignIn />
        </AuthProvider>
      );

      const signInButton = screen.getByText('Sign In');

      // Click multiple times
      await act(async () => {
        signInButton.click();
        signInButton.click();
        signInButton.click();
      });

      // Should only call Firebase once
      expect(vi.mocked(signInWithEmailAndPassword)).toHaveBeenCalledTimes(1);

      // Resolve the sign in
      await act(async () => {
        resolveSignIn({ user: mockUser });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Session Cookie Integration', () => {
    it('should retry session cookie creation on failure', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observerOrNext) => {
        if (typeof observerOrNext === 'function') {
          observerOrNext(null);
        }
        return () => {};
      });

      const mockUser: Partial<FirebaseUser> = {
        uid: 'test-uid',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser as FirebaseUser,
      } as any);

      // First call fails, second succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ 
          ok: true, 
          json: async () => ({ success: true }) 
        });

      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '__session=test-cookie',
      });

      const TestWithSignIn = () => {
        const { signInWithEmail } = useAuth();
        return (
          <button onClick={() => signInWithEmail('test@test.com', 'pass')}>
            Sign In
          </button>
        );
      };

      render(
        <AuthProvider>
          <TestWithSignIn />
        </AuthProvider>
      );

      const signInButton = screen.getByText('Sign In');
      await act(async () => {
        signInButton.click();
      });

      // Should retry and eventually succeed
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockPush).toHaveBeenCalledWith('/library/book');
      }, { timeout: 3000 });
    });

    it('should show error after max retries exceeded', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, observerOrNext) => {
        if (typeof observerOrNext === 'function') {
          observerOrNext(null);
        }
        return () => {};
      });

      const mockUser: Partial<FirebaseUser> = {
        uid: 'test-uid',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser as FirebaseUser,
      } as any);

      // All attempts fail
      mockFetch.mockResolvedValue({ ok: false });

      const TestWithSignIn = () => {
        const { signInWithEmail, error } = useAuth();
        return (
          <div>
            <button onClick={() => signInWithEmail('test@test.com', 'pass')}>
              Sign In
            </button>
            <div data-testid="error">{error || 'no-error'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestWithSignIn />
        </AuthProvider>
      );

      const signInButton = screen.getByText('Sign In');
      await act(async () => {
        signInButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(/Could not create a server session/);
      }, { timeout: 3000 });

      // Should not navigate on error
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});