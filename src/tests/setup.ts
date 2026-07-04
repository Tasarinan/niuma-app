import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test case (React Testing Library)
afterEach(() => {
  cleanup();
});

// Mock Web Audio API (not available in test environment)
// Use function syntax for proper constructor mocking
global.AudioContext = function (this: any) {
  // Mock decodeAudioData to return a proper AudioBuffer-like object
  // By default, returns empty buffer (tests can override this)
  this.decodeAudioData = vi.fn().mockImplementation((arrayBuffer: ArrayBuffer) => {
    return Promise.resolve({
      getChannelData: (channel: number) => new Float32Array(0),
      numberOfChannels: 1,
      length: 0,
      sampleRate: 44100,
      duration: 0,
    });
  });
  this.createBuffer = vi.fn();
  this.createBufferSource = vi.fn();
  this.destination = {};
  this.sampleRate = 44100;
  this.state = 'running';
  this.close = vi.fn().mockImplementation(() => { this.state = 'closed'; });
} as any;

// Mock window.AudioContext for browsers
(global as any).window = global.window || {};
(global.window as any).AudioContext = global.AudioContext;
(global.window as any).webkitAudioContext = global.AudioContext;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock performance.now() for consistent timing in tests
let performanceNow = 0;
global.performance = {
  now: vi.fn(() => {
    performanceNow += 10; // Each call adds 10ms
    return performanceNow;
  }),
} as any;
