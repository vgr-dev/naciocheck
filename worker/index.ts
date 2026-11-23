/**
 * The Worker behind `naciocheck.vgr.cat`. `wrangler.jsonc` runs it first only for `/api/*`; every other
 * path is served from `site/` without invoking it. The feedback endpoint arrives in a later step, so for
 * now every request it sees is unknown.
 */

// Types `env` from `cloudflare:workers` and `exports.default` in the tests; the names match `wrangler.jsonc`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- the only way to extend the runtime's types
  namespace Cloudflare {
    interface Env {
      FEEDBACK_LIMIT: RateLimit;
      FEEDBACK_MAIL: SendEmail;
      TURNSTILE_EXPECTED_HOSTNAME: string;
      /** Set with `wrangler secret put`; never committed. */
      TURNSTILE_SECRET: string;
    }
    interface GlobalProps {
      mainModule: typeof import('./index');
    }
  }
}

export type Env = Cloudflare.Env;

export default {
  fetch(): Response {
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
