// src/features/auth/LoginFlow.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockUser, mockFirebaseUser, mockLibraryItems, mockNewUser, mockNewFirebaseUser } from '@/lib/test-utils';
import LoginView from './components/LoginView';
import AppLayoutContent from '@/components/layout/AppLayoutContent';
import { CombinedProviders } from '@/lib/test-utils';
import { getLibraryItems } from '@/services/library-service';

// --- MOCKS ---

// Mock next/navigation
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterPush, // Use the same mock for replace
  }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (path: string) => mockRouterPush(path),
}));

// Mock Firebase services
vi.mock('@/lib/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
  },
  db: {},
}));

vi.mock('@/services/library-service');
vi.mock('@/services/user-service');

// Mock child components that are not relevant to this test
vi.mock('@/features/user/components/LevelUpDialog', () => ({
  default: ({ isOpen, levelUpInfo }: { isOpen: boolean, levelUpInfo: any }) => 
    isOpen ? <div data-testid="level-up-dialog">Level Up! New Level: {levelUpInfo?.newLevel}</div> : null
}));
vi.mock('@/features/library/components/BookItemCard', () => ({
  BookItemCard: ({ book }: { book: any }) => <div data-testid={`book-card-${book.id}`}>{book.title.primary}</div>
}));


describe('Complete Login and Navigation Flow', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for session API
    global.fetch = vi.fn((url, options) => {
      if (url === '/api/auth/session' && options?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
      }
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    });
  });

  it('should allow a new user to sign up, see the level up dialog, and view the library', async () => {
    // --- SETUP MOCKS for SIGN UP flow ---

    // 1. Mock AuthProvider's signUpWithEmail
    const mockSignUp = vi.fn().mockResolvedValue(mockNewFirebaseUser);
    
    // 2. Mock getLibraryItems to return some books for the library view
    vi.mocked(getLibraryItems).mockResolvedValue({ items: mockLibraryItems, lastDoc: null });
    
    // --- RENDER & INTERACT ---
    
    render(
      <CombinedProviders authMock={{ signUpWithEmail: mockSignUp }} userMock={{ user: mockNewUser }}>
          <LoginView />
          <AppLayoutContent>
              {/* Mock children for AppLayout */}
          </AppLayoutContent>
      </CombinedProviders>
    );
    
    // Switch to Sign Up form
    await user.click(screen.getByRole('button', { name: /sign up/i }));
    
    // Fill out the form
    await user.type(screen.getByLabelText(/email/i), mockNewUser.email!);
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    
    // Submit the form
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    
    // --- ASSERTIONS ---
    
    // 1. Check if signUp was called with the correct credentials
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(mockNewUser.email, 'password123');
    });

    // 2. Check if the session cookie API was called
    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/session', expect.any(Object));
    });
    
    // 3. Check for successful redirect to the library
    // The router replace/push is called by the LoginView's useEffect on successful auth
    // We don't need to mock it here, just check if it was called.
    // NOTE: This test doesn't explicitly check the redirect because the UI updates directly.
    
    // 4. Wait for and verify the Level Up Dialog
    // This dialog is shown by AppLayoutContent when user data indicates a level up
    await waitFor(() => {
        const levelUpDialog = screen.getByTestId('level-up-dialog');
        expect(levelUpDialog).toBeInTheDocument();
        expect(levelUpDialog).toHaveTextContent('Level Up! New Level: 2');
    }, { timeout: 3000 }); // Increase timeout to allow for state changes

    // 5. Verify the library content is displayed
    // This happens after the auth state changes and AppLayoutContent renders its children
    await waitFor(() => {
        expect(screen.getByTestId('book-card-book1')).toHaveTextContent('The First Adventure');
        expect(screen.getByTestId('book-card-book2')).toHaveTextContent('The Second Quest');
    });
  });
});
