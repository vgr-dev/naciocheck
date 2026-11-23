import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [await WxtVitest()],
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/worker/**', 'node_modules/**'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
