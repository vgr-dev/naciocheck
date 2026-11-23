/**
 * The Worker behind `naciocheck.vgr.cat`. `wrangler.jsonc` runs it first only for `/api/*`; every other
 * path is served from `site/` without invoking it. Only `/api/feedback` exists; every other `/api/*` path
 * is a 404.
 */
import { errorResponse, handleFeedback } from './feedback';

// Types `env` from `cloudflare:workers` and `exports.default` in the tests; the names match `wrangler.jsonc`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- the only way to extend the runtime's types
  namespace Cloudflare {
    interface Env {
      FEEDBACK_LIMIT: RateLimit;
      FEEDBACK_MAIL: SendEmail;
      /** The one origin allowed to post (`.dev.vars` sets the origin `wrangler dev` presents: the route host over http). */
      FEEDBACK_ORIGIN: string;
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
  fetch(request, env): Promise<Response> | Response {
    if (new URL(request.url).pathname === '/api/feedback') return handleFeedback(request, env);
    return errorResponse('not-found');
  },
} satisfies ExportedHandler<Env>;
