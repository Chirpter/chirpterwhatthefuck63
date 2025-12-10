// src/contexts/__tests__/auth-context.test.tsx - FIXED VERSION
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-context';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

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

const TestComponent = () => {
  const { authUser, loading, isSigningIn, error, signInWithEmail, clearAuthError } = useAuth();
  
  return (
    <div data-testid="auth-container">
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="user">{authUser?.uid || 'no-user'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="signing-in">{isSigningIn ? 'signing-in' : 'not-signing-in'}</div>
      <button onClick={() => signInWithEmail('test@test.com', 'password')}>
        Sign In
      </button>
      <button onClick={clearAuthError}>Clear Error</button>
    </div>
  );
};

describe('AuthContext Unit Tests', () => {
  let mockNavigate: Mock;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    document.cookie = '';
    mockPush.mockClear();
    mockRefresh.mockClear();
    
    mockNavigate = vi.fn();
    Object.defineProperty(window, 'location', {
      value: {
        assign: mockNavigate,
        href: '',
      },
      writable: true,
      configurable: true,
    });
    
    global.fetch = vi.fn((input: string | URL | Request, options?: RequestInit) => {
      const urlString = input instanceof URL ? input.toString() : 
                       input instanceof Request ? input.url : 
                       input;
      
      if (urlString.includes('/api/auth/session') && options?.method === 'POST') {
        setTimeout(() => {
          document.cookie = '__session=test-cookie; path=/';
        }, 50);
        
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }
      
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    }) as any;
  });

  afterEach(() => {
    cleanup();
  });

  describe('Initial State', () => {
    it('should start in loading state', () => {
      vi.mocked(onAuthStateChanged).mockImplementation(() => () => {});

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    it('should transition to loaded state with user', async () => {
      const mockUser = { uid: 'test-uid-123' } as FirebaseUser;

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(mockUser), 0);
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

    it('should transition to loaded state without user', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(null), 0);
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
    it('should handle invalid credentials error', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(null), 0);
        return () => {};
      });

      vi.mocked(signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/invalid-credential',
      });

      const { container } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      const signInButton = container.querySelector('button');
      expect(signInButton).toBeTruthy();

      await act(async () => {
        signInButton?.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password');
      });
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(null), 0);
        return () => {};
      });

      vi.mocked(signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/network-request-failed',
      });

      const { container } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      const signInButton = container.querySelector('button');
      await act(async () => {
        signInButton?.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });
    });
    
    // ✅ NEW: Email validation test
    it('should validate email before sign-in', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(null), 0);
        return () => {};
      });

      const TestInvalidEmail = () => {
        const { error, signInWithEmail } = useAuth();
        return (
          <div>
            <div data-testid="error">{error || 'no-error'}</div>
            <button onClick={() => signInWithEmail('invalid-email', 'password123')}>
              Sign In
            </button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestInvalidEmail />
        </AuthProvider>
      );

      await waitFor(() => screen.getByText('Sign In'));

      fireEvent.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Please enter a valid email address');
      });
    });
  });

  describe('State Management', () => {
    it('should clear error when clearAuthError is called', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(null), 0);
        return () => {};
      });

      vi.mocked(signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/invalid-credential',
      });

      const { container } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      const buttons = container.querySelectorAll('button');
      const signInButton = buttons[0];
      const clearErrorButton = buttons[1];

      await act(async () => {
        signInButton?.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password');
      });

      await act(async () => {
        clearErrorButton?.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });
    });
  });

  describe('Concurrent Operation Protection', () => {
    it('should prevent multiple concurrent sign-in operations', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(null), 0);
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

      const { container } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      const signInButton = container.querySelector('button');

      await act(async () => {
        signInButton?.click();
        signInButton?.click();
        signInButton?.click();
      });

      expect(vi.mocked(signInWithEmailAndPassword)).toHaveBeenCalledTimes(1);

      resolveSignIn();

      await waitFor(() => {
        expect(screen.getByTestId('signing-in')).toHaveTextContent('not-signing-in');
      }, { timeout: 3000 });
    });
  });

  describe('Session Cookie Integration', () => {
    // ✅ FIXED: Test should succeed on attempt 2 (within maxRetries=2)
    it('should retry session cookie creation on failure', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(null), 0);
        return () => {};
      });

      const mockUser = {
        uid: 'test-123',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser as any,
      } as any);

      let attempts = 0;
      global.fetch = vi.fn((input: string | URL | Request, options?: RequestInit) => {
        attempts++;
        const urlString = input instanceof URL ? input.toString() :
                         input instanceof Request ? input.url :
                         input;

        if (urlString.includes('/api/auth/session') && options?.method === 'POST') {
          // ✅ FIXED: Fail on attempt 1, succeed on attempt 2
          if (attempts < 2) {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: async () => ({ error: 'temporary' }),
            } as Response);
          }

          setTimeout(() => {
            document.cookie = '__session=test-cookie; path=/';
          }, 50);

          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }) as any;

      const { container } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      const signInButton = container.querySelector('button');
      await act(async () => {
        signInButton?.click();
      });

      // ✅ Should succeed after exactly 2 attempts
      await waitFor(() => {
        expect(attempts).toBe(2);
        expect(mockNavigate).toHaveBeenCalledWith('/library/book');
      }, { timeout: 3000 });
    }, 5000);

    it('should show error after max retries exceeded', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(null), 0);
        return () => {};
      });

      const mockUser = {
        uid: 'test-123',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      };

      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser as any,
      } as any);

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'server error' }),
        } as Response)
      ) as any;

      const { container } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      const signInButton = container.querySelector('button');
      await act(async () => {
        signInButton?.click();
      });

      await waitFor(() => {
        const errorText = screen.getByTestId('error').textContent;
        expect(errorText).toContain('Could not create a server session');
      }, { timeout: 3000 });
    });
  });
});