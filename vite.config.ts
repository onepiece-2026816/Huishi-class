import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiPort = env.API_PORT || '4000';
    return {
      server: {
        port: Number(env.WEB_PORT || 3000),
        // The API validates TTS WebSocket origins against CLIENT_ORIGIN.
        // Keep the web port stable so proxy upgrades continue to match it.
        strictPort: true,
        host: '0.0.0.0',
        watch: { ignored: ['**/teacher-studio-service/generated/**', '**/server/storage/**'] },
        proxy: {
          '/api': {
            target: `http://localhost:${apiPort}`,
            changeOrigin: true,
            xfwd: true,
            ws: true,
          },
        },
      },
      plugins: [react(), tailwindcss()],
      optimizeDeps: { entries: ['index.html'] },
      resolve: {
        alias: {
          '@': path.resolve(import.meta.dirname, '.'),
        }
      }
    };
});
