import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type Server } from 'node:https';
import { join, resolve } from 'node:path';
import { browser } from '@wdio/globals';
import { networkGuard } from './network-guard';

/**
 * The fake sede: the captured pages, served from a local HTTPS server at the real URLs.
 *
 * Chrome is started with `--host-resolver-rules` (see `../wdio.conf.ts`), which resolves the three hosts the
 * captured pages use to this server and every other host to `NOTFOUND`: no request can leave the machine, and
 * nothing is intercepted, so there is no request for Chrome to lose (D10). The manifest, the content script's
 * `matches` and the background's window are the ones that ship.
 *
 * One server per worker (`maxInstances: 1`), started in the `before` hook and closed in `after`; each test only
 * swaps the scenario it answers with.
 */

/** The one URL the extension opens, and the one the captured form posts back to. */
export const SEDE_FORM_URL = 'https://sede.mjusticia.gob.es/eConsultas/inicioNacionalidad';

/** The hosts Chrome resolves to the fake server, and the only ones the browser may reach. */
export const FAKE_HOSTS = [
  'sede.mjusticia.gob.es',
  'www.recaptcha.net',
  'fonts.googleapis.com',
] as const;

/** Where `onPrepare` writes the certificate of the run. Git-ignored with the rest of `e2e/.artifacts/`. */
export const TLS_DIR = resolve(import.meta.dirname, '../.artifacts/tls');

export const TLS_KEY = join(TLS_DIR, 'key.pem');

export const TLS_CERT = join(TLS_DIR, 'cert.pem');

/** The pages captured from the real site. Read-only: placeholders are filled in memory, never on disk. */
const CAPTURED_DIR = resolve('tests/fixtures');

/** Pages the suite writes itself, because the site never produced the shape. Always marked synthetic. */
const SYNTHETIC_DIR = resolve('e2e/fixtures');

const RECAPTCHA_STUB = resolve('e2e/stubs/recaptcha-stub.js');

/**
 * The loopback port the fake site listens on. One worker owns it; `E2E_SEDE_PORT` moves it out of the way when
 * something else is using it.
 */
export function fakeSedePort(): number {
  const raw = process.env.E2E_SEDE_PORT ?? '47443';
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`E2E_SEDE_PORT must be a port number, not '${raw}'.`);
  }
  return port;
}

export interface FakePage {
  /** Absolute path of the HTML the suite answers with. */
  readonly path: string;
  /** `{placeholder}` values, substituted in memory. */
  readonly values: Readonly<Record<string, string>>;
}

/** A page captured from the real site, with its personal values replaced by `{placeholders}`. */
export function capturedPage(name: string, values: Record<string, string> = {}): FakePage {
  return { path: join(CAPTURED_DIR, name), values };
}

/** A page the suite wrote itself: only for a shape the real site has not produced. */
export function syntheticPage(name: string): FakePage {
  return { path: join(SYNTHETIC_DIR, name), values: {} };
}

/** The placeholders of the captured result page: only fake values ever go into them. */
export const RESULT_VALUES = {
  expendiente: 'R500001',
  year: '2015',
  NIE: 'X0000000X',
  names: 'NOMBRE',
  surname: 'APELLIDO',
  status: 'Abierto - Registrado.',
  subStatus: 'Su expediente ha sido registrado correctamente.',
};

/** The captured result page, with the personal values filled in and any of them overridden per test. */
export function capturedResultPage(values: Record<string, string> = {}): FakePage {
  return capturedPage('result-format.htm', { ...RESULT_VALUES, ...values });
}

export interface FakeSedeOptions {
  /** The GET answer of the form. The captured form unless a test needs an unknown shape. */
  readonly form?: FakePage;
  /** The POST answers, in order. The last one answers every further POST; empty answers nothing. */
  readonly results: readonly FakePage[];
}

export interface FakeSede {
  /** Every POST the browser made to the form, in order. An empty list proves nothing was submitted. */
  readonly posts: string[];
  /** Every asset URL the suite answered, in order, for assertions on what the browser asked for. */
  readonly served: string[];
  /** Requests the server refused: a host outside the three mapped ones, which must never be reachable. */
  readonly unexpected: string[];
}

/** What the server answers with right now: a new scenario per test, on a server that outlives it. */
interface Scenario {
  readonly form: FakePage;
  readonly results: readonly FakePage[];
  answered: number;
  readonly posts: string[];
  readonly served: string[];
  readonly unexpected: string[];
}

/**
 * The server and the scenario the suite is currently answering with.
 *
 * Kept on `globalThis` for the same reason the network guard is: WDIO loads this file once for the config and
 * once per spec file, so a module-scoped variable would be two variables — the server would answer from the
 * config's copy while the specs set the other one.
 */
const FAKE_SEDE_KEY = '__naciocheckFakeSede';

interface FakeSedeState {
  server?: Server;
  scenario?: Scenario;
}

function state(): FakeSedeState {
  const holder = globalThis as unknown as { [FAKE_SEDE_KEY]?: FakeSedeState };
  holder[FAKE_SEDE_KEY] ??= {};
  return holder[FAKE_SEDE_KEY];
}

/** Starts the fake site on the loopback port. Fails loudly when the port is taken. */
export async function startFakeSede(): Promise<void> {
  if (state().server !== undefined) return;
  if (!existsSync(TLS_KEY) || !existsSync(TLS_CERT)) {
    throw new Error(
      `The fake site needs the certificate of this run in ${TLS_DIR}; onPrepare writes it with openssl.`,
    );
  }

  const port = fakeSedePort();
  const created = createServer(
    { key: readFileSync(TLS_KEY), cert: readFileSync(TLS_CERT) },
    handleRequest,
  );

  await new Promise<void>((resolveListening, reject) => {
    created.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? `Port ${port} is already in use: stop the process using it or set E2E_SEDE_PORT.`
            : `The fake site could not listen on 127.0.0.1:${port}: ${error.message}`,
        ),
      );
    });
    created.listen(port, '127.0.0.1', () => {
      created.removeAllListeners('error');
      resolveListening();
    });
  });

  state().server = created;
}

/** Closes the fake site and forgets the scenario. */
export async function stopFakeSede(): Promise<void> {
  const running = state().server;
  state().server = undefined;
  state().scenario = undefined;
  if (running === undefined) return;
  await new Promise<void>((resolveClosed) => {
    running.close(() => {
      resolveClosed();
    });
    running.closeAllConnections();
  });
}

/** Points the fake site at this test's scenario and returns the lists the test asserts on. */
export function serveFakeSede(options: FakeSedeOptions): FakeSede {
  const scenario: Scenario = {
    form: options.form ?? capturedPage('form.html'),
    results: options.results,
    answered: 0,
    posts: [],
    served: [],
    unexpected: [],
  };
  state().scenario = scenario;
  return { posts: scenario.posts, served: scenario.served, unexpected: scenario.unexpected };
}

/**
 * Answers one request.
 *
 * The captured pages ask `sede.mjusticia.gob.es` for their stylesheets, scripts and images; all of them are
 * empty 200s, because none is needed to exercise the extension. `Cache-Control: no-store` keeps one test's page
 * out of the next one's cache.
 */
function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  const host = (request.headers.host ?? '').split(':')[0] ?? '';
  const url = new URL(request.url ?? '/', `https://${host}`);
  const scenario = state().scenario;

  if (scenario === undefined) {
    notFound(response, url);
    return;
  }

  if (host === FAKE_HOSTS[0]) {
    if (url.pathname === new URL(SEDE_FORM_URL).pathname) {
      if (request.method === 'POST') {
        scenario.posts.push(url.href);
        const page = scenario.results[Math.min(scenario.answered, scenario.results.length - 1)];
        scenario.answered += 1;
        send(response, 'text/html; charset=utf-8', page === undefined ? '' : renderPage(page));
        return;
      }
      scenario.served.push(url.href);
      send(response, 'text/html; charset=utf-8', renderPage(scenario.form));
      return;
    }
    scenario.served.push(url.href);
    send(response, contentTypeOf(url.pathname), '');
    return;
  }

  if (host === FAKE_HOSTS[1]) {
    scenario.served.push(url.href);
    const body = url.pathname.endsWith('/recaptcha/api.js')
      ? readFileSync(RECAPTCHA_STUB, 'utf8')
      : '';
    send(response, 'application/javascript; charset=utf-8', body);
    return;
  }

  if (host === FAKE_HOSTS[2]) {
    scenario.served.push(url.href);
    send(response, 'text/css; charset=utf-8', '');
    return;
  }

  // A host outside the three mapped ones: `--host-resolver-rules` should have made it unreachable, so it is
  // reported to the test and to the run's guard instead of being answered.
  scenario.unexpected.push(url.href);
  networkGuard().noteUnexpected(url.href);
  notFound(response, url);
}

function send(response: ServerResponse, contentType: string, body: string): void {
  response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
  response.end(body);
}

function notFound(response: ServerResponse, url: URL): void {
  response.writeHead(404, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`The fake sede does not answer ${url.href}`);
}

/** How long a read of a document may take before it is treated as one that never settled. */
const READ_TIMEOUT_MS = 2_000;

/**
 * Waits, bounded, until the window shows a page the suite served.
 *
 * The read has a timeout of its own: a command sent to a document that never settles otherwise waits for ever,
 * and a suite that hangs tells nobody anything.
 */
export async function awaitFakePage(
  scope: WebdriverIO.BrowsingContext,
  timeoutMs = 10_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await showsFakePage(scope)) return true;
    await browser.pause(200);
  }
  return false;
}

/** Whether this tab is showing a page the suite served; `false` when the document cannot be read. */
async function showsFakePage(scope: WebdriverIO.BrowsingContext): Promise<boolean> {
  const read = scope
    .execute(() => document.querySelector('meta[name="naciocheck-e2e-fake"]') !== null)
    .catch(() => false);
  return Promise.race([
    read,
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), READ_TIMEOUT_MS);
    }),
  ]);
}

/**
 * Writes the token the content script's poll looks for. Only a fake page has the stub, so this cannot touch a
 * real captcha: the extension itself never produces one.
 */
export async function solveStubCaptcha(
  scope: WebdriverIO.Browser | WebdriverIO.BrowsingContext,
): Promise<void> {
  await scope.execute(() => {
    const token = document.querySelector<HTMLInputElement>('input[name="gRecaptchaResponse"]');
    if (token === null) throw new Error('This page has no captcha: it is not the fake sede form');
    token.value = 'naciocheck-e2e-stub-token';
    token.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/**
 * Tells a page the suite served from an error page Chrome rendered by itself, and gives `awaitFakePage()`
 * something to wait for before the content script has run.
 */
const FAKE_MARKER = '<meta name="naciocheck-e2e-fake" content="1">';

function renderPage(page: FakePage): string {
  const html = readFileSync(page.path, 'utf8');
  const filled = Object.entries(page.values).reduce(
    (text, [placeholder, value]) => text.replaceAll(`{${placeholder}}`, value),
    html,
  );
  return filled.replace(/<head[^>]*>/i, (head) => `${head}${FAKE_MARKER}`);
}

/** The captured pages reference stylesheets, scripts and images; an empty 200 of the right type is plenty. */
function contentTypeOf(pathname: string): string {
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'text/plain; charset=utf-8';
}
