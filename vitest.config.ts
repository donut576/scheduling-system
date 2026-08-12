import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // The default 5000ms testTimeout is tight for RTL/userEvent-driven tests
    // (form fills, modal interactions, async waitFor) once many test files
    // run concurrently and compete for CPU. Individual tests here complete
    // in ~1-2s in isolation but have been observed to exceed 5000ms under
    // full-suite parallel load. Raise the default ceiling suite-wide instead
    // of patching timeouts on individual tests one at a time.
    testTimeout: 15000,
    env: {
      VITE_APP_TITLE: '藝康排班系統',
      VITE_API_BASE_URL: 'http://localhost:3000',
      VITE_WS_URL: 'ws://localhost:3000',
      VITE_UPLOAD_MAX_SIZE: '10485760',
    },
  },
});
