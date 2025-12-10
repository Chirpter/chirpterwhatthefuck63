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

// ✅ FIXED: Proper cleanup between tests
let mockCleanupFunctions: Array<() => void> = [];

export function registerMockCleanup(cleanup: () => void) {
  mockCleanupFunctions.push(cleanup);
}

export function cleanupAllMocks() {
  mockCleanupFunctions.forEach(cleanup => cleanup());
  mockCleanupFunctions = [];
  vi.clearAllMocks();
}

// Auto-cleanup after each test
afterEach(() => {
  cleanupAllMocks();
});

// ✅ FIXED: Better mock provider with proper isolation
interface MockProviderProps {
  children: React.ReactNode;
  initialAuthUser?: FirebaseUser | null;
  initialUser?: AppUser | null;
  initialAuthLoading?: boolean;
  initialUserLoading?: boolean;
}

/**
 * ✅ FIXED: Isolated test wrapper with proper mocking
 */
export const CombinedProviders: React.FC<MockProviderProps> = ({ 
  children,
  initialAuthUser = null,
  initialUser = null,
  initialAuthLoading = false,
  initialUserLoading = false,
}) => {
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

// ✅ NEW: Helper to create authenticated context
export const createAuthenticatedMocks = () => {
  return {
    authUser: mockFirebaseUser,
    loading: false,
    isSigningIn: false,
    error: null,
    signUpWithEmail: vi.fn().mockResolvedValue(true),
    signInWithEmail: vi.fn().mockResolvedValue(true),
    signInWithGoogle: vi.fn().mockResolvedValue(true),
    logout: vi.fn().mockResolvedValue(undefined),
    clearAuthError: vi.fn(),
  };
};

// ✅ NEW: Helper to create user context mocks
export const createUserContextMocks = (user = mockUser) => {
  return {
    user,
    loading: false,
    error: null,
    levelUpInfo: null,
    clearLevelUpInfo: vi.fn(),
    reloadUser: vi.fn().mockResolvedValue(undefined),
    retryUserFetch: vi.fn(),
  };
};

// ✅ NEW: Helper to setup mock fetch for tests
export const setupMockFetch = (responses: Record<string, any> = {}) => {
  const defaultResponses = {
    '/api/auth/session': { success: true },
    ...responses,
  };

  global.fetch = vi.fn((input: string | URL | Request, options?: RequestInit) => {
    const urlString = input instanceof URL ? input.toString() : 
                     input instanceof Request ? input.url : 
                     input;
    
    // ✅ FIX: Use hasOwnProperty to safely access the property
    const response = Object.prototype.hasOwnProperty.call(defaultResponses, urlString) 
      ? defaultResponses[urlString as keyof typeof defaultResponses] 
      : { success: true };
    
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(response),
      headers: new Headers(),
      status: 200,
      statusText: 'OK',
    } as Response);
  }) as any;

  registerMockCleanup(() => {
    vi.restoreAllMocks();
  });
};

// ✅ NEW: Helper to setup document.cookie mock
export const setupMockCookie = (initialCookie = '') => {
  let cookieStore = initialCookie;
  
  Object.defineProperty(document, 'cookie', {
    get: () => cookieStore,
    set: (value: string) => {
      // Simple cookie parser for tests
      const parts = value.split(';')[0].split('=');
      const name = parts[0].trim();
      const val = parts[1] || '';
      
      if (value.includes('Max-Age=0') || value.includes('expires=Thu, 01 Jan 1970')) {
        // Delete cookie
        cookieStore = cookieStore
          .split(';')
          .filter(c => !c.trim().startsWith(name))
          .join(';');
      } else {
        // Add/Update cookie
        const existingCookies = cookieStore
          .split(';')
          .filter(c => c.trim() && !c.trim().startsWith(name));
        existingCookies.push(`${name}=${val}`);
        cookieStore = existingCookies.join(';');
      }
    },
    configurable: true,
  });

  registerMockCleanup(() => {
    cookieStore = '';
  });

  return {
    getCookie: () => cookieStore,
    setCookie: (value: string) => { document.cookie = value; },
    clearCookies: () => { cookieStore = ''; },
  };
};
