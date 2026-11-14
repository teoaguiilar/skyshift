import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In local development, send /api calls to the published site (vite dev does not run api/).
    proxy: { '/api': { target: 'https://skyshift-roan.vercel.app', changeOrigin: true } },
  },
})
