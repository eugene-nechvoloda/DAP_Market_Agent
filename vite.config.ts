import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  root: path.resolve(__dirname, 'src/ui'),

  build: {
    outDir: path.resolve(__dirname, 'dist/ui'),
    emptyOutDir: true,
    sourcemap: true,
  },

  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/ui'),
      '@components': path.resolve(__dirname, 'src/ui/components'),
      '@pages': path.resolve(__dirname, 'src/ui/pages'),
      '@styles': path.resolve(__dirname, 'src/ui/styles'),
      '@hooks': path.resolve(__dirname, 'src/ui/hooks'),
      '@types': path.resolve(__dirname, 'src/ui/types'),
      '@services': path.resolve(__dirname, 'src/ui/services'),
    },
  },
});
