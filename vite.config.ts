import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Source maps would ship readable crypto code paths and inflate the
    // bundle; the decrypting page is deliberately shipped minified only.
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        // The Firebase SDK dwarfs the app and changes on its own schedule;
        // splitting it keeps the app chunk small and cacheable across deploys.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/app-check'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
