// vitest-setup.ts - IMPROVED VERSION
import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// ✅ FIX: Mock Firebase environment variables BEFORE any imports
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test-project.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test-project.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:123456789:web:abcdef';
process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = 'G-ABCDEFGH';

// ✅ FIX: Global test isolation with better cleanup
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // ✅ FIX: Better cookie mock with proper get/set
  let cookieStore = '';
  
  Object.defineProperty(document, 'cookie', {
    get: () => cookieStore,
    set: (value: string) => {
      // Parse cookie string
      const parts = value.split(';')[0].split('=');
      const name = parts[0].trim();
      const val = parts[1] || '';
      
      // Check if it's a deletion
      if (value.includes('Max-Age=0') || value.includes('expires=Thu, 01 Jan 1970')) {
        // Delete cookie
        cookieStore = cookieStore
          .split(';')
          .filter(c => c.trim() && !c.trim().startsWith(name))
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
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

// Mock for SpeechSynthesis API
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
  onvoiceschanged: null,
  speaking: false,
  pending: false,
};

Object.defineProperty(window, 'speechSynthesis', {
  value: mockSpeechSynthesis,
  writable: true,
  configurable: true,
});

// Mock for matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock for IntersectionObserver
const mockIntersectionObserver = vi.fn((callback, options) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

// Mock for ResizeObserver
const mockResizeObserver = vi.fn((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('ResizeObserver', mockResizeObserver);

// ✅ FIX: Better localStorage mock with proper isolation
const createLocalStorageMock = () => {
  let store: { [key: string]: string } = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
};

Object.defineProperty(window, 'localStorage', {
  value: createLocalStorageMock(),
  writable: true,
  configurable: true,
});

// ✅ FIX: Default mock fetch (can be overridden in tests)
global.fetch = vi.fn((input: string | URL | Request, options?: RequestInit) => {
  const urlString = input instanceof URL ? input.toString() : 
                   input instanceof Request ? input.url : 
                   input;
  
  // Default successful response
  let responseData = { success: true };
  let status = 200;
  
  // Handle specific routes with defaults
  if (urlString.includes('/api/auth/session')) {
    if (options?.method === 'DELETE') {
      responseData = { success: true };
    } else if (options?.method === 'POST') {
      responseData = { success: true };
    }
  }
  
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData)),
    headers: new Headers({
      'content-type': 'application/json',
    }),
    redirected: false,
    type: 'basic' as ResponseType,
    url: urlString,
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    bytes: vi.fn(),
  } as any as Response);
}) as any;

// ✅ FIX: Suppress unnecessary console noise in tests
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

console.log = vi.fn();
console.warn = vi.fn();
console.error = (...args: any[]) => {
  // Only show actual errors, not expected test logs
  if (!args[0]?.includes?.('[Auth]') && 
      !args[0]?.includes?.('[USER_CTX]') &&
      !args[0]?.includes?.('[API Session]') &&
      !args[0]?.includes?.('[Middleware]')) {
    originalConsole.error(...args);
  }
};

// Export cleanup utilities
export const cleanupTestEnvironment = () => {
  vi.clearAllMocks();
  localStorage.clear();
  document.cookie = '';
};