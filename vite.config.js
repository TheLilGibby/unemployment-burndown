import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false, // allow self-signed certs from dev server
      },
      // usePlaid hook calls /plaid/* paths (matching Lambda routes),
      // but the dev server mounts them at /api/plaid/*. Rewrite so
      // both hooks work through the Vite proxy without VITE_PLAID_API_URL.
      '/plaid': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => `/api${path}`,
      },
    },
  },
})
