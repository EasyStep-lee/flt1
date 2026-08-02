import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/supplier/',
  build: {
    outDir: 'dist',
  },
  plugins: [react()],
});
