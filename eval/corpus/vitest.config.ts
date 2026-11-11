import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['eval/corpus/**/*.test.ts'],
    environment: 'node',
  },
});
