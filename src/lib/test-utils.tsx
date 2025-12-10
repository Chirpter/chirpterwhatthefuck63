// src/lib/test-utils.tsx
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { UserProvider, useUser } from '@/contexts/user-context';
import { AudioPlayerProvider } from '@/contexts/audio-player-context';
import { SettingsProvider } from '@/contexts/settings-context';
import { BookmarkProvider } from '@/contexts/bookmark-context';
import { vi } from 'vitest';
import type { User as FirebaseUser } from 'firebase/auth';
import type { User as AppUser, CombinedBookmark } from './types';

// --- MOCK DATA ---

// Mock FirebaseUser
export const mockFirebaseUser: FirebaseUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://placehold.co/100x100.png',
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  providerId: 'firebase',
  tenantId: null,
  delete: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue('fake-id-token'),
  getIdTokenResult: vi.fn(),
  reload: vi.fn(),
  toJSON: vi.fn(),
} as any;

// Mock AppUser
export const mockUser: AppUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://placehold.co/100x100.png',
  plan: 'free',
  role: 'user',
  credits: 100,
  level: 1,
  lastLoginDate: '2024-01-01',
  isAnonymous: false,
  stats: {
    booksCreated: 5,
    level: 1,
    piecesCreated: 0,
    vocabSaved: 0,
    flashcardsMastered: 0,
    coversGeneratedByAI: 0,
    bilingualBooksCreated: 0,
    vocabAddedToPlaylist: 0,
  },
  achievements: [],
  purchasedBookIds: [],
  ownedBookmarkIds: [],
};

// Mock Bookmarks
export const mockBookmarks: CombinedBookmark[] = [];

// --- MOCK PROVIDERS WRAPPER ---

interface MockProviderProps {
  children: React.ReactNode;
  authMock?: Partial<ReturnType<typeof useAuth>>;
  userMock?: Partial<ReturnType<typeof useUser>>;
}

/**
 * A helper component to apply mocks before rendering children.
 */
const MockInjector: React.FC<MockProviderProps> = ({ children, authMock, userMock }) => {
  if (authMock) {
    vi.spyOn(require('@/contexts/auth-context'), 'useAuth').mockReturnValue(authMock);
  }
  if (userMock) {
    vi.spyOn(require('@/contexts/user-context'), 'useUser').mockReturnValue(userMock);
  }
  return <>{children}</>;
};

/**
 * A utility component to wrap test components with all necessary providers.
 * It allows overriding specific context values for targeted testing.
 */
export const CombinedProviders: React.FC<MockProviderProps> = ({ children, authMock, userMock }) => {
  // ✅ FIX: Default mocks với correct signatures
  const defaultAuthMock: ReturnType<typeof useAuth> = {
    authUser: null,
    loading: false,
    isSigningIn: false,
    error: null,
    logout: vi.fn(),
    // ✅ FIX: Correct return type (Promise<boolean>)
    signUpWithEmail: vi.fn().mockResolvedValue(true),
    signInWithEmail: vi.fn().mockResolvedValue(true),
    signInWithGoogle: vi.fn().mockResolvedValue(true),
    clearAuthError: vi.fn(),
    ...authMock,
  };

  const defaultUserMock: ReturnType<typeof useUser> = {
    user: null,
    loading: false,
    error: null,
    levelUpInfo: null,
    clearLevelUpInfo: vi.fn(),
    reloadUser: vi.fn(),
    retryUserFetch: vi.fn(),
    ...userMock,
  };
  
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <UserProvider>
          <SettingsProvider>
            <BookmarkProvider initialBookmarks={mockBookmarks}>
              <AudioPlayerProvider>
                <MockInjector authMock={defaultAuthMock} userMock={defaultUserMock}>
                  {children}
                </MockInjector>
              </AudioPlayerProvider>
            </BookmarkProvider>
          </SettingsProvider>
        </UserProvider>
      </AuthProvider>
    </I18nextProvider>
  );
};

// ✅ NEW: Helper to create authenticated test context
export const createAuthenticatedContext = (user = mockUser): Partial<ReturnType<typeof useAuth>> => ({
  authUser: mockFirebaseUser,
  loading: false,
  isSigningIn: false,
  error: null,
});

// ✅ NEW: Helper to create user context
export const createUserContext = (user = mockUser): Partial<ReturnType<typeof useUser>> => ({
  user,
  loading: false,
  error: null,
  levelUpInfo: null,
});