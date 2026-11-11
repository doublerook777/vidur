import { fileURLToPath } from 'node:url';

import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
  server: { proxy: { '/ws': { target: 'ws://127.0.0.1:8080', ws: true }, '/api': 'http://127.0.0.1:8080', '/healthz': 'http://127.0.0.1:8080' } },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        app: fileURLToPath(new URL('app.html', import.meta.url)),
      },
    },
  },
});
