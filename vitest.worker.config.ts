import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// The Worker tests run in the Workers runtime through Miniflare, fully offline. The bindings come from
// `wrangler.jsonc`; the secret below is a placeholder, not a credential.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: { TURNSTILE_SECRET: 'test-only-not-a-real-secret' },
      },
    }),
  ],
  test: {
    include: ['tests/worker/**/*.test.ts'],
  },
});
