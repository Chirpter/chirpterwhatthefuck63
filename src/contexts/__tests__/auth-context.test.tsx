// src/contexts/__tests__/auth-context.test.tsx - FIXED VERSION
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-context';
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
      <button onClick={() => signInWithEmail('test@test.com', 'password123')}>
        Sign In
      </button>
      <button onClick={clearAuthError}>Clear Error</button>
    </div>
  );
};

describe('AuthContext Unit Tests', () => {

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockPush.mockClear();
    mockRefresh.mockClear();
    
    global.fetch = vi.fn((input: string | URL | Request, options?: RequestInit) => {
      const urlString = input instanceof URL ? input.toString() : 
                       input instanceof Request ? input.url : 
                       input;
      
      if (urlString.includes('/api/auth/session') && options?.method === 'POST') {
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

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      const signInButton = screen.getByText('Sign In');
      expect(signInButton).toBeTruthy();

      await act(async () => {
        signInButton?.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password.');
      });
    });
    
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
        expect(screen.getByTestId('error')).toHaveTextContent('Please enter a valid email address.');
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

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      const signInButton = screen.getByText('Sign In');
      const clearErrorButton = screen.getByText('Clear Error');

      await act(async () => {
        signInButton?.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password.');
      });

      await act(async () => {
        clearErrorButton?.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });
    });
  });

  describe('Navigation', () => {
      it('should navigate using router.push on successful sign-in', async () => {
        vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
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
  
        render(<AuthProvider><TestComponent /></AuthProvider>);
  
        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
        });
  
        const signInButton = screen.getByText('Sign In');
        fireEvent.click(signInButton);
  
        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/library/book');
        });
      });
  });
});
