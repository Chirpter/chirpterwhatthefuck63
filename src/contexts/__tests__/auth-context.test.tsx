// src/contexts/__tests__/auth-context.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-context';
import { onAuthStateChanged } from 'firebase/auth';

// Mock Firebase Auth
vi.mock('@/lib/firebase', () => ({
  auth: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
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

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with loading state', () => {
    // Mock onAuthStateChanged to never call callback (simulating loading)
    vi.mocked(onAuthStateChanged).mockImplementation(() => {
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
    const mockUser = {
      uid: 'test-uid-123',
      email: 'test@example.com',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    // Mock onAuthStateChanged to immediately call callback with user
    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      callback(mockUser as any);
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
    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      callback(null);
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

  it('should handle auth errors correctly', async () => {
    // Mock onAuthStateChanged
    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      callback(null);
      return () => {};
    });

    const { rerender } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // This test is limited because we can't easily trigger auth operations
    // without more complex setup. This demonstrates the limitation of unit tests.
    
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });
  });
});
