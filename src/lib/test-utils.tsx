
// src/lib/test-utils.tsx

import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { AuthProvider } from '@/providers/auth-provider';
import { UserProvider } from '@/providers/user-provider';
import { AudioPlayerProvider } from '@/contexts/audio-player-context';
import { SettingsProvider } from '@/contexts/settings-context';
import { BookmarkProvider } from '@/contexts/bookmark-context';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
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

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

/**
 * Mocks the window.location object for navigation tests.
 * This is crucial for testing navigation logic without actual browser reloads.
 */
export function setupLocationMock() {
  const mockNavigate = vi.fn((path: string) => {
    // This console log helps trace navigation calls during tests.
    console.log(`[TEST] Mock navigation to: ${path}`);
  });
  
  const mockReplace = vi.fn();
  
  const originalLocation = window.location;

  // Use delete to allow re-defining the window.location property
  delete (window as any).location;

  const mockLocation = {
    assign: mockNavigate,
    replace: mockReplace,
    href: 'http://localhost:3000/',
    // Add other properties if your code uses them
  };

  Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
    configurable: true,
  });

  const cleanup = () => {
    // Restore the original window.location object after tests
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    mockNavigate.mockClear();
    mockReplace.mockClear();
  };

  return {
    mockNavigate,
    mockReplace,
    cleanup,
  };
}

/**
 * A wrapper component that provides all necessary contexts for testing individual components.
 */
export const CombinedProviders: React.FC<{children: React.ReactNode}> = ({ children }) => {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <UserProvider>
          <SettingsProvider>
            <BookmarkProvider initialBookmarks={mockBookmarks}>
              <AudioPlayerProvider>
                {children}
              </AudioPlayerProvider>
            </BookmarkProvider>
          </SettingsProvider>
        </UserProvider>
      </AuthProvider>
    </I18nextProvider>
  );
};
