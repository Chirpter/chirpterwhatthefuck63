// src/features/auth/__tests__/logout-flow.test.tsx - FIXED VERSION
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { setupLocationMock } from '@/lib/test-utils';

// Mock Firebase
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
  const { authUser, loading, logout } = useAuth();
  
  return (
    <div>
      <div data-testid="auth-user">{authUser?.uid || 'null'}</div>
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('Logout Flow Tests', () => {
  let locationMock: ReturnType<typeof setupLocationMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = '';
    locationMock = setupLocationMock();
    
    global.fetch = vi.fn(() => 
      Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)
    ) as any;
  });

  afterEach(() => {
    cleanup();
    locationMock.cleanup();
  });

  describe('Basic Logout Flow', () => {
    it('should logout authenticated user successfully', async () => {
      const mockUser = {
        uid: 'test-user-123',
        email: 'test@example.com',
      } as FirebaseUser;

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => (callback as any).next ? (callback as any).next(mockUser) : callback(mockUser), 0);
        return () => {};
      });

      vi.mocked(signOut).mockResolvedValue(undefined);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-user')).toHaveTextContent('test-user-123');
      });

      fireEvent.click(screen.getByText('Logout'));

      await waitFor(() => {
        expect(vi.mocked(signOut)).toHaveBeenCalledTimes(1);
        // ✅ FIX: Check for credentials: 'include' in fetch call
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/session', { 
          method: 'DELETE',
          credentials: 'include'
        });
        expect(locationMock.mockNavigate).toHaveBeenCalledWith('/login?reason=logged_out');
      });
    });

    it('should clear session cookie on logout', async () => {
      const mockUser = {
        uid: 'test-user-123',
        email: 'test@example.com',
      } as FirebaseUser;

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => (callback as any).next ? (callback as any).next(mockUser) : callback(mockUser), 0);
        return () => {};
      });

      vi.mocked(signOut).mockResolvedValue(undefined);

      document.cookie = '__session=test-cookie-value; path=/';

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-user')).toHaveTextContent('test-user-123');
      });

      fireEvent.click(screen.getByText('Logout'));

      await waitFor(() => {
        // ✅ FIX: Check for credentials: 'include'
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/session', { 
          method: 'DELETE',
          credentials: 'include'
        });
      });
    });
  });

  describe('Error Handling During Logout', () => {
    it('should handle Firebase signOut error gracefully', async () => {
      const mockUser = {
        uid: 'test-user-123',
        email: 'test@example.com',
      } as FirebaseUser;

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback: any) => {
        setTimeout(() => (callback as any).next ? (callback as any).next(mockUser) : callback(mockUser), 0);
        return () => {};
      });

      vi.mocked(signOut).mockRejectedValue(new Error('Firebase signOut failed'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-user')).toHaveTextContent('test-user-123');
      });

      fireEvent.click(screen.getByText('Logout'));

      await waitFor(() => {
        expect(locationMock.mockNavigate).toHaveBeenCalledWith('/login?reason=error');
      });
    });
  });
});