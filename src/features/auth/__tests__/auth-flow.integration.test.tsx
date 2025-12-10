// src/features/auth/__tests__/auth-flow-complete.integration.test.tsx
// PRODUCTION READY - Complete integration tests with cookie polling
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

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

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  auth: {},
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
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = '';
    
    // Mock successful fetch with proper cookie simulation
    global.fetch = vi.fn((url: string | URL | Request, options?: RequestInit) => {
      const urlString = url instanceof URL ? url.toString() : 
                       url instanceof Request ? url.url : 
                       url;
      
      if (urlString.includes('/api/auth/session') && options?.method === 'POST') {
        // Simulate cookie being set with delay to mimic real behavior
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
        setTimeout(() => callback.next(null), 0);
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
    }, { timeout: 5000 }); // Increased timeout for cookie polling

    // Verify cookie was set
    expect(document.cookie).toContain('__session=');
    expect(document.cookie).toContain('test-session-cookie-value-12345');
    
    // Verify navigation
    expect(mockPush).toHaveBeenCalledWith('/library/book');
    expect(mockRefresh).toHaveBeenCalled();
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
        setTimeout(() => callback.next(null), 0);
      }
      return () => {};
    });

    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser as any,
    } as any);

    // Mock fetch that doesn't set cookie (simulating failure)
    global.fetch = vi.fn(() => 
      Promise.resolve({
        ok: true,
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

    // Should show error after cookie polling timeout
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Could not create a server session. Please try again.');
    }, { timeout: 5000 });

    // Should not navigate on error
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should retry session creation on failure', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        setTimeout(() => callback(null), 0);
      } else {
        setTimeout(() => callback.next(null), 0);
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

    // Should eventually succeed after retries
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(mockPush).toHaveBeenCalledWith('/library/book');
    }, { timeout: 5000 });
  });

  it('should prevent concurrent sign-in operations', async () => {
    const mockUser = {
      uid: 'test-123',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
       if (typeof callback === 'function') {
        setTimeout(() => callback(null), 0);
      } else {
        setTimeout(() => callback.next(null), 0);
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
        setTimeout(() => callback.next(null), 0);
      }
      return () => {};
    });

    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser as any,
    } as any);

    // All attempts fail
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

    // Should show error after max retries
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Could not create a server session. Please try again.');
    }, { timeout: 5000 });
  });
});
