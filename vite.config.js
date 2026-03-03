import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverUrl = env.DEV_SERVER_URL || 'http://localhost:3001'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
          secure: false, // allow self-signed certs from dev server
        },
        '/plaid': {
          target: serverUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
