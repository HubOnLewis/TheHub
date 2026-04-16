import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mtte-core/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    host:  '0.0.0.0',
    port:  5173,
    proxy: {
      '/api': {
        target:      process.env['VITE_API_URL'] ?? 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api'),
      },
    },
  },
});
