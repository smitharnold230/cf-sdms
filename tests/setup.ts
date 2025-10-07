/**
 * Test setup file for mocking Cloudflare Workers environment
 */

import { vi } from 'vitest';

// Mock Cloudflare Workers globals
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      getRandomValues: vi.fn().mockImplementation((arr: any) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
      randomUUID: vi.fn().mockImplementation(() => 
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        })
      ),
      subtle: {
        importKey: vi.fn(),
        sign: vi.fn(),
        verify: vi.fn(),
        digest: vi.fn(),
      }
    },
    writable: true
  });
}

Object.assign(globalThis, {
  fetch: vi.fn(),
  Request: globalThis.Request || class MockRequest {},
  Response: globalThis.Response || class MockResponse {},
  Headers: globalThis.Headers || class MockHeaders {},
  FormData: globalThis.FormData || class MockFormData {},
  URLSearchParams: globalThis.URLSearchParams || class MockURLSearchParams {}
});

// Mock WebSocketPair for Cloudflare Workers
(globalThis as any).WebSocketPair = class MockWebSocketPair {
  [0]: any;
  [1]: any;

  constructor() {
    const mockSocket = {
      accept: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: 1, // OPEN
      url: '',
      protocol: '',
      extensions: '',
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null
    };

    this[0] = mockSocket;
    this[1] = mockSocket;
  }
};

// Mock console methods to reduce test noise
const originalConsole = console;
console.log = vi.fn();
console.info = vi.fn();
console.warn = vi.fn();
console.error = originalConsole.error; // Keep errors visible