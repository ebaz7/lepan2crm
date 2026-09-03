
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
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx') || id.includes('exceljs')) return 'vendor-excel';
            if (id.includes('docx') || id.includes('docxtemplater') || id.includes('mammoth')) return 'vendor-docx';
            if (id.includes('jspdf') || id.includes('pdf-lib') || id.includes('pdfjs-dist')) return 'vendor-pdf';
            if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('motion')) return 'vendor-motion';
            if (id.includes('quill') || id.includes('react-quill')) return 'vendor-editor';
            return 'vendor';
          }
        },
      },
    },
  },
})

