import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
  },
});
