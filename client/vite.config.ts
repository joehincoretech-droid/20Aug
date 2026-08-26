import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow Cloudflare quick tunnels (and similar) for phone testing
    allowedHosts: true,
    proxy: {
      '/api': 'http://127.0.0.1:5001',
    },
  },
});
