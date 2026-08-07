import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = Number(process.env.API_PORT ?? '3000');
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65_535) {
  throw new Error('API_PORT must be an integer between 1 and 65535');
}

export default defineConfig({
  base: '/supplier/',
  build: {
    outDir: 'dist',
  },
  plugins: [react()],
  server: {
    proxy: {
      '/v1': {
        changeOrigin: true,
        target: `http://127.0.0.1:${apiPort}`,
      },
    },
  },
});
