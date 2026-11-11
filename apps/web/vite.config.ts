import { fileURLToPath } from 'node:url';

import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        app: fileURLToPath(new URL('app.html', import.meta.url)),
      },
    },
  },
});
