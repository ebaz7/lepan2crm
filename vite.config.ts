
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Check if we are building for Android / Capacitor dynamically
const isAndroid = 
  process.env.BUILD_TARGET === 'android' || 
  process.env.npm_lifecycle_event === 'mobile' ||
  process.env.npm_lifecycle_event === 'build:apk' ||
  process.argv.includes('--android');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: isAndroid ? './' : '/', // Absolute path for Web deployment, relative path for Android build
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    watch: {
      ignored: ['**/android/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})

