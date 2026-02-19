/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read version from src/version.json
let appVersion = 0;
try {
  const versionData = JSON.parse(
    readFileSync(resolve(__dirname, '../version.json'), 'utf-8')
  );
  appVersion = versionData.version ?? 0;
} catch { /* fallback to 0 */ }

const frontendPort = 5000 + appVersion;
const backendPort = 8700 + appVersion;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: appVersion,
  },
  server: {
    port: frontendPort,
    proxy: {
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
      },
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    define: {
      __APP_VERSION__: 0,
    },
  },
});
