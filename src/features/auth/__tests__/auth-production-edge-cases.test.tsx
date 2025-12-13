// src/features/auth/__tests__/auth-production-edge-cases.test.tsx - FIXED
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
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

const TestComponent = () => {
  const { authUser, loading, isSigningIn, error, signInWithEmail, logout } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="user">{authUser?.uid || 'no-user'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="signing-in">{isSigningIn ? 'true' : 'false'}</div>
      <button onClick={() => signInWithEmail('test@test.com', 'password')}>
        Sign In
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('Auth Production Edge Cases', () => {
  let locationMock: ReturnType<typeof setupLocationMock>;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    document.cookie = '';
    locationMock = setupLocationMock();
    
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    locationMock.cleanup();
  });

  describe('Session Cookie Creation', () => {
    it('should succeed immediately and navigate when session API works', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => callback(null), 0);
        return () => {};
      });

      const mockUser = {
        uid: 'test-123',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      } as Partial<FirebaseUser> as FirebaseUser;

      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser,
      } as any);

      global.fetch = vi.fn(() => 
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
      ) as any;

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      const startTime = Date.now();
      
      fireEvent.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(locationMock.mockNavigate).toHaveBeenCalledWith('/library/book');
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(2000); // Should be very fast
      }, { timeout: 3000 });
    });

    it('should show an error after retries if session API consistently fails', async () => {
        vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
            setTimeout(() => callback(null), 0);
            return () => {};
        });

      const mockUser = {
        uid: 'test-123',
        getIdToken: vi.fn().mockResolvedValue('fake-token'),
      } as Partial<FirebaseUser> as FirebaseUser;

      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser,
      } as any);

      global.fetch = vi.fn(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' }),
        } as Response)
      ) as any;

      render(
        <AuthProvider>
          <TestComponent />
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

      expect(locationMock.mockNavigate).not.toHaveBeenCalled();
    }, 5000);
  });
});
