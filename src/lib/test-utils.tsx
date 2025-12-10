// src/lib/test-utils.tsx - FIXED VERSION
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { AuthProvider } from '@/contexts/auth-context';
import { UserProvider } from '@/contexts/user-context';
import { AudioPlayerProvider } from '@/contexts/audio-player-context';
import { SettingsProvider } from '@/contexts/settings-context';
import { BookmarkProvider } from '@/contexts/bookmark-context';
import { vi, beforeEach, afterEach } from 'vitest';
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
 * ✅ FIXED: Enhanced mock with better tracking
 */
export function setupLocationMock() {
  const mockNavigate = vi.fn((path: string) => {
    // Simulate immediate navigation for tests
    console.log('[TEST] Navigate called:', path);
  });
  
  const mockReplace = vi.fn();
  
  // Store original location to restore it
  const originalLocation = window.location;
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

  // Delete the property to make it reconfigurable
  delete (window as any).location;

  // ✅ FIXED: Create a proper mock that matches window.location interface
  const mockLocation = {
    assign: mockNavigate,
    replace: mockReplace,
    href: 'http://localhost:3000/',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    reload: vi.fn(),
    toString: () => 'http://localhost:3000/',
  };

  Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
    configurable: true,
  });

  const cleanup = () => {
    // Restore the original location object
    if (originalDescriptor) {
      Object.defineProperty(window, 'location', originalDescriptor);
    } else {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
    mockNavigate.mockClear();
    mockReplace.mockClear();
  };

  return {
    mockNavigate,
    mockReplace,
    getNavigatedUrl: () => mockNavigate.mock.calls[0]?.[0],
    getReplacedUrl: () => mockReplace.mock.calls[0]?.[0],
    getAllNavigations: () => mockNavigate.mock.calls.map(call => call[0]),
    wasNavigatedTo: (path: string) => mockNavigate.mock.calls.some(call => call[0] === path),
    cleanup,
  };
}

/**
 * ✅ FIXED: Isolated test wrapper with proper mocking
 */
export const CombinedProviders: React.FC = ({ children }) => {
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