// vitest-setup.ts - FIXED VERSION
import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// ✅ FIXED: Global test isolation
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Reset document.cookie
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: '',
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

// ✅ FIXED: Better localStorage mock with cleanup
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

// ✅ FIXED: Mock fetch with better default behavior
global.fetch = vi.fn((input: string | URL | Request, options?: RequestInit) => {
  const urlString = input instanceof URL ? input.toString() : 
                   input instanceof Request ? input.url : 
                   input;
  
  // Default successful response
  let responseData = { success: true };
  let status = 200;
  
  // Handle specific routes
  if (urlString.includes('/api/auth/session')) {
    if (options?.method === 'DELETE') {
      responseData = { success: true };
    } else if (options?.method === 'POST') {
      responseData = { success: true };
      
      // Simulate setting cookie
      setTimeout(() => {
        document.cookie = '__session=test-session-cookie; path=/';
      }, 0);
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

// ✅ FIXED: Mock console methods to reduce noise in tests
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

// Only show errors in tests, suppress logs and warnings
console.log = vi.fn();
console.warn = vi.fn();
console.error = (...args: any[]) => {
  // Only show actual errors, not expected test errors
  if (!args[0]?.includes?.('[Auth]') && !args[0]?.includes?.('[USER_CTX]')) {
    originalConsole.error(...args);
  }
};

// ✅ Export cleanup utilities
export const cleanupTestEnvironment = () => {
  vi.clearAllMocks();
  localStorage.clear();
  document.cookie = '';
};