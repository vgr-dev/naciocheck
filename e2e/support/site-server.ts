import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { networkGuard } from './network-guard';

/**
 * The built site (`.output/site/`), served from a local HTTP server for the browser specs.
 *
 * It answers the way Cloudflare's static assets do with the settings in `wrangler.jsonc`, so the specs see what a
 * visitor sees:
 *
 * - `auto-trailing-slash`: `/en` redirects to `/en/`, and `/en/index.html` to `/en/`.
 * - `404-page`: a path that is no file answers 404 with the nearest `404.html` going up the path, so `/ca/nope`
 *   gets the Catalan page and `/nope` the Spanish one.
 *
 * Chrome reaches it as `SITE_HOST` through `--host-resolver-rules` (see `../wdio.conf.ts`), the same way it
 * reaches the fake sede: no request is intercepted and no other host resolves. The feedback pages are not
 * covered: they load Turnstile from a host that does not exist here.
 */

/** The only host the browser may use to reach the site; the `.test` TLD is reserved and never resolves. */
export const SITE_HOST = 'site.naciocheck.test';

/** Where `npm run build:site` writes the site. */
export const SITE_DIR = resolve(import.meta.dirname, '../../.output/site');

/** The URL of a site path in the browser. The mapped port is the one the rule rewrites, so none is written. */
export function siteUrl(path: string): string {
  return `http://${SITE_HOST}${path}`;
}

/**
 * The loopback port the site listens on. One worker owns it; `E2E_SITE_PORT` moves it out of the way when
 * something else is using it.
 */
export function siteServerPort(): number {
  const raw = process.env.E2E_SITE_PORT ?? '47444';
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`E2E_SITE_PORT must be a port number, not '${raw}'.`);
  }
  return port;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Kept on `globalThis` for the reason the fake sede is: WDIO loads this file once per config and per spec. */
const SITE_SERVER_KEY = '__naciocheckSiteServer';

function holder(): { [SITE_SERVER_KEY]?: Server } {
  return globalThis as unknown as { [SITE_SERVER_KEY]?: Server };
}

/** Starts the site server on the loopback port. Fails loudly when the build is missing or the port is taken. */
export async function startSiteServer(): Promise<void> {
  if (holder()[SITE_SERVER_KEY] !== undefined) return;
  if (!existsSync(join(SITE_DIR, 'index.html'))) {
    throw new Error(`The site is not built: run \`npm run build:site\` (expected ${SITE_DIR}).`);
  }

  const port = siteServerPort();
  const created = createServer(handleRequest);
  await new Promise<void>((resolveListening, reject) => {
    created.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? `Port ${port} is already in use: stop the process using it or set E2E_SITE_PORT.`
            : `The site server could not listen on 127.0.0.1:${port}: ${error.message}`,
        ),
      );
    });
    created.listen(port, '127.0.0.1', () => {
      created.removeAllListeners('error');
      resolveListening();
    });
  });
  holder()[SITE_SERVER_KEY] = created;
}

/** Closes the site server. */
export async function stopSiteServer(): Promise<void> {
  const running = holder()[SITE_SERVER_KEY];
  holder()[SITE_SERVER_KEY] = undefined;
  if (running === undefined) return;
  await new Promise<void>((resolveClosed) => {
    running.close(() => {
      resolveClosed();
    });
    running.closeAllConnections();
  });
}

function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  const host = (request.headers.host ?? '').split(':')[0] ?? '';
  const url = new URL(request.url ?? '/', `http://${host}`);

  // A host other than the mapped one means the resolver rules failed: report it to the run's guard.
  if (host !== SITE_HOST) {
    networkGuard().noteUnexpected(url.href);
    reply(
      response,
      404,
      'text/plain; charset=utf-8',
      `The site server does not answer ${url.href}`,
    );
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    reply(response, 405, 'text/plain; charset=utf-8', 'Method not allowed');
    return;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    reply(response, 400, 'text/plain; charset=utf-8', 'Bad request');
    return;
  }

  // `/en/index.html` is `/en/`: the redirect auto-trailing-slash makes.
  if (pathname.endsWith('/index.html')) {
    redirect(response, pathname.slice(0, -'index.html'.length) + url.search);
    return;
  }

  const found = resolveFile(pathname);
  if (found.kind === 'outside') {
    reply(response, 400, 'text/plain; charset=utf-8', 'Bad request');
    return;
  }
  if (found.kind === 'needs-slash') {
    redirect(response, `${pathname}/${url.search}`);
    return;
  }
  if (found.kind === 'file') {
    sendFile(response, 200, found.path);
    return;
  }

  const page = nearest404(pathname);
  if (page === null) {
    reply(response, 404, 'text/plain; charset=utf-8', 'Not found');
    return;
  }
  sendFile(response, 404, page);
}

type Found =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'needs-slash' | 'outside' | 'none' };

/** The file a path names, a folder asked without its slash, a path outside the site, or nothing. */
function resolveFile(pathname: string): Found {
  const target = resolve(SITE_DIR, `.${pathname}`);
  if (target !== SITE_DIR && !target.startsWith(SITE_DIR + sep)) return { kind: 'outside' };
  if (!existsSync(target)) return { kind: 'none' };

  const stats = statSync(target);
  if (stats.isFile()) return { kind: 'file', path: target };
  if (stats.isDirectory() && existsSync(join(target, 'index.html'))) {
    return pathname.endsWith('/')
      ? { kind: 'file', path: join(target, 'index.html') }
      : { kind: 'needs-slash' };
  }
  return { kind: 'none' };
}

/** The `404.html` closest to the path: `/ca/nope` → `/ca/404.html`, then up to `/404.html`. */
function nearest404(pathname: string): string | null {
  let folder = resolve(SITE_DIR, `.${pathname.endsWith('/') ? pathname : dirname(pathname)}`);
  while (folder === SITE_DIR || folder.startsWith(SITE_DIR + sep)) {
    const candidate = join(folder, '404.html');
    if (existsSync(candidate)) return candidate;
    if (folder === SITE_DIR) break;
    folder = dirname(folder);
  }
  return null;
}

function sendFile(response: ServerResponse, status: number, file: string): void {
  const type = CONTENT_TYPES[extname(file)] ?? 'application/octet-stream';
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(readFileSync(file));
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(301, { location, 'cache-control': 'no-store' });
  response.end();
}

function reply(response: ServerResponse, status: number, type: string, body: string): void {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(body);
}
