import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// The Worker tests run in the Workers runtime through Miniflare, fully offline. The bindings come from
// `wrangler.jsonc`; the secret below is a placeholder, not a credential. The vars are pinned to their
// production values so a local `.dev.vars` (made for `npm run dev:site`) cannot change what is tested.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TURNSTILE_SECRET: 'test-only-not-a-real-secret',
          FEEDBACK_ORIGIN: 'https://naciocheck.vgr.cat',
          TURNSTILE_EXPECTED_HOSTNAME: 'naciocheck.vgr.cat',
        },
      },
    }),
  ],
  test: {
    include: ['tests/worker/**/*.test.ts'],
  },
});
