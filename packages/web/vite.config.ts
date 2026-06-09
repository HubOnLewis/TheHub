import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@hub-crm/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    host:  '0.0.0.0',
    port:  5173,
    // Forward /api/* to the Express app (must match packages/api PORT, default 3001).
    // Do not point `target` at a URL that already ends in `/api` — use host + port only.
    proxy: {
      '/api': {
        target:       'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
