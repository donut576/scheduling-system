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
    env: {
      VITE_APP_TITLE: '藝康排班系統',
      VITE_API_BASE_URL: 'http://localhost:3000',
      VITE_WS_URL: 'ws://localhost:3000',
      VITE_UPLOAD_MAX_SIZE: '10485760',
    },
  },
});
