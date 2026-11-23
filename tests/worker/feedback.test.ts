import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_BODY_BYTES } from '../../worker/checks';
import {
  FEEDBACK_ADDRESS,
  FEEDBACK_SUBJECT,
  SITEVERIFY_URL,
  handleFeedback,
} from '../../worker/feedback';

const URL_OF_ENDPOINT = 'https://naciocheck.vgr.cat/api/feedback';
const TOKEN = 'token-from-the-widget';
// A fake NIE: the Worker must mask it again even though the page already did.
const TEXT = 'No entiendo mi estado. Mi NIE X1234567L aparece en pantalla.';
const REDACTED = 'No entiendo mi estado. Mi NIE [NIE] aparece en pantalla.';

type Verdict = Response | Error | (() => Response | Promise<Response>);

let mailSent: EmailMessageBuilder[];
let mailFails: boolean;
let limited: boolean;
let limitKeys: string[];
let siteverifyCalls: { url: string; init: RequestInit | undefined }[];
let unexpectedFetches: string[];
let verdict: Verdict;
let consoleCalls: unknown[][];

function siteverifyAnswer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeEnv(overrides: Partial<Cloudflare.Env> = {}): Cloudflare.Env {
  return {
    ...env,
    FEEDBACK_LIMIT: {
      limit: (options) => {
        limitKeys.push(options.key);
        return Promise.resolve({ success: !limited });
      },
    },
    FEEDBACK_MAIL: {
      send: (message: EmailMessageBuilder | EmailMessage) => {
        if (mailFails) return Promise.reject(new Error('mail binding down'));
        mailSent.push(message as EmailMessageBuilder);
        return Promise.resolve({ messageId: 'test-id' });
      },
    },
    ...overrides,
  };
}

function post(
  body: BodyInit | null = JSON.stringify({ text: TEXT, token: TOKEN }),
  headers: Record<string, string | null> = {},
): Request {
  const merged: Record<string, string | null> = {
    'Content-Type': 'application/json',
    Origin: 'https://naciocheck.vgr.cat',
    'Sec-Fetch-Site': 'same-origin',
    'CF-Connecting-IP': '203.0.113.7',
    ...headers,
  };
  const init: Record<string, string> = {};
  for (const [name, value] of Object.entries(merged)) {
    if (value !== null) init[name] = value;
  }
  return new Request(URL_OF_ENDPOINT, { method: 'POST', headers: init, body });
}

async function expectRejected(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: code });
  expect(mailSent).toEqual([]);
}

beforeEach(() => {
  mailSent = [];
  mailFails = false;
  limited = false;
  limitKeys = [];
  siteverifyCalls = [];
  unexpectedFetches = [];
  consoleCalls = [];
  verdict = () =>
    siteverifyAnswer({ success: true, hostname: 'naciocheck.vgr.cat', 'error-codes': [] });
  // The only outbound request allowed is siteverify; anything else is recorded and fails.
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== SITEVERIFY_URL) {
      unexpectedFetches.push(url);
      return Promise.reject(new Error(`unexpected outbound fetch: ${url}`));
    }
    siteverifyCalls.push({ url, init });
    if (verdict instanceof Error) return Promise.reject(verdict);
    return Promise.resolve(verdict instanceof Response ? verdict : verdict());
  });
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      consoleCalls.push(args);
    });
  }
});

afterEach(() => {
  expect(unexpectedFetches).toEqual([]);
  const logged = JSON.stringify(consoleCalls);
  expect(logged).not.toContain(TOKEN);
  expect(logged).not.toContain('X1234567L');
  expect(logged).not.toContain('No entiendo');
  vi.restoreAllMocks();
});

describe('POST /api/feedback', () => {
  it('sends exactly one email whose body is the redacted text, then answers 204', async () => {
    const response = await handleFeedback(post(), makeEnv());

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(mailSent).toEqual([
      { from: FEEDBACK_ADDRESS, to: FEEDBACK_ADDRESS, subject: FEEDBACK_SUBJECT, text: REDACTED },
    ]);
    expect(mailSent[0]?.text).toContain('[NIE]');
    expect(mailSent[0]?.text).not.toContain('X1234567L');
  });

  it('keeps accents and other UTF-8 in the body', async () => {
    const text = 'Añadí ñ, é, ü y 日本語';
    const response = await handleFeedback(post(JSON.stringify({ text, token: TOKEN })), makeEnv());

    expect(response.status).toBe(204);
    expect(mailSent[0]?.text).toBe(text);
  });

  it('asks siteverify once, with the secret, the token and the client address, and nothing else', async () => {
    await handleFeedback(post(), makeEnv());

    expect(siteverifyCalls).toHaveLength(1);
    const call = siteverifyCalls[0];
    expect(call?.init?.method).toBe('POST');
    const form = call?.init?.body;
    expect(form).toBeInstanceOf(URLSearchParams);
    const fields = Object.fromEntries((form as URLSearchParams).entries());
    expect(fields).toEqual({
      secret: 'test-only-not-a-real-secret',
      response: TOKEN,
      remoteip: '203.0.113.7',
    });
  });

  it('omits remoteip when the client address is unknown', async () => {
    await handleFeedback(post(undefined, { 'CF-Connecting-IP': null }), makeEnv());

    const form = siteverifyCalls[0]?.init?.body as URLSearchParams;
    expect([...form.keys()].sort()).toEqual(['response', 'secret']);
    expect(limitKeys).toEqual(['unknown']);
  });

  it('rate-limits by the client address', async () => {
    await handleFeedback(post(), makeEnv());

    expect(limitKeys).toEqual(['203.0.113.7']);
  });

  it('answers 429 and sends nothing for a rate-limited client, before any body read or siteverify', async () => {
    limited = true;

    await expectRejected(await handleFeedback(post(), makeEnv()), 429, 'rate-limited');
    expect(siteverifyCalls).toEqual([]);
  });

  it.each([
    ['a missing token', JSON.stringify({ text: TEXT })],
    ['an empty token', JSON.stringify({ text: TEXT, token: '' })],
    ['a missing text', JSON.stringify({ token: TOKEN })],
    ['invalid JSON', '{nope'],
    ['an extra field', JSON.stringify({ text: TEXT, token: TOKEN, extra: 1 })],
  ])('answers 400 bad-body for %s and does not call siteverify', async (_name, body) => {
    await expectRejected(await handleFeedback(post(body), makeEnv()), 400, 'bad-body');
    expect(siteverifyCalls).toEqual([]);
  });

  it('answers 413 for a body over the cap, declared or not, without calling siteverify', async () => {
    const big = JSON.stringify({ text: 'a'.repeat(MAX_BODY_BYTES), token: TOKEN });

    await expectRejected(await handleFeedback(post(big), makeEnv()), 413, 'too-large');
    // No Content-Length header at all: the capped read must catch it.
    const chunk = new TextEncoder().encode(big);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk.slice(0, 5000));
        controller.enqueue(chunk.slice(5000));
        controller.close();
      },
    });
    const streamed = new Request(URL_OF_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://naciocheck.vgr.cat' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect(streamed.headers.get('Content-Length')).toBeNull();
    await expectRejected(await handleFeedback(streamed, makeEnv()), 413, 'too-large');
    // A lying Content-Length is rejected by the header check.
    await expectRejected(
      await handleFeedback(post(undefined, { 'Content-Length': '999999' }), makeEnv()),
      413,
      'too-large',
    );
    expect(siteverifyCalls).toEqual([]);
  });

  it.each([
    ['success false', { success: false, 'error-codes': ['invalid-input-response'] }],
    ['a spent token', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
    ['a wrong hostname', { success: true, hostname: 'evil.example' }],
    ['a missing hostname', { success: true }],
    ['an answer that is not an object', 'yes'],
  ])('answers 403 turnstile for %s and sends nothing', async (_name, answer) => {
    verdict = siteverifyAnswer(answer);

    await expectRejected(await handleFeedback(post(), makeEnv()), 403, 'turnstile');
  });

  it.each([
    ['a network error', new Error('network down')],
    ['a 500 answer', new Response('oops', { status: 500 })],
    ['an answer that is not JSON', new Response('<html>', { status: 200 })],
  ])('answers 502 upstream for a siteverify outage: %s', async (_name, outage) => {
    verdict = outage;

    await expectRejected(await handleFeedback(post(), makeEnv()), 502, 'upstream');
  });

  it('answers 502 upstream when the mail binding throws, and says nothing about why', async () => {
    mailFails = true;

    await expectRejected(await handleFeedback(post(), makeEnv()), 502, 'upstream');
  });

  it('answers 405 to GET and checks nothing else first', async () => {
    const request = new Request(URL_OF_ENDPOINT, { method: 'GET' });

    await expectRejected(await handleFeedback(request, makeEnv()), 405, 'method');
    expect(limitKeys).toEqual([]);
  });

  it('answers 415 to text/plain', async () => {
    await expectRejected(
      await handleFeedback(post(undefined, { 'Content-Type': 'text/plain' }), makeEnv()),
      415,
      'content-type',
    );
  });

  it.each([
    ['a cross-origin Origin', { Origin: 'https://evil.example' }],
    ['a missing Origin', { Origin: null }],
    ['Sec-Fetch-Site cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
  ])(
    'answers 403 origin for %s without touching the limiter or siteverify',
    async (_name, headers) => {
      await expectRejected(
        await handleFeedback(post(undefined, headers), makeEnv()),
        403,
        'origin',
      );
      expect(limitKeys).toEqual([]);
      expect(siteverifyCalls).toEqual([]);
    },
  );

  it('reads the expected origin and hostname from the environment', async () => {
    verdict = siteverifyAnswer({ success: true, hostname: 'example.com' });
    const local = makeEnv({
      FEEDBACK_ORIGIN: 'http://localhost:8787',
      TURNSTILE_EXPECTED_HOSTNAME: 'example.com',
    });

    const ok = await handleFeedback(post(undefined, { Origin: 'http://localhost:8787' }), local);
    expect(ok.status).toBe(204);
    expect(mailSent).toHaveLength(1);

    // The production origin no longer passes against a local environment.
    const prod = await handleFeedback(post(), local);
    expect(prod.status).toBe(403);
    expect(mailSent).toHaveLength(1);
  });

  it('never sets the body or the token in a response', async () => {
    verdict = siteverifyAnswer({ success: false });
    const response = await handleFeedback(post(), makeEnv());
    const raw = await response.text();

    expect(raw).not.toContain(TOKEN);
    expect(raw).not.toContain('NIE');
  });
});

describe('routing through the Worker entry point', () => {
  it('answers 404 with a JSON code to every other /api path, without outbound requests', async () => {
    for (const path of ['/api/', '/api/other', '/api/feedback/', '/api/feedback/extra']) {
      const response = await exports.default.fetch(`https://naciocheck.vgr.cat${path}`);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not-found' });
    }
    expect(siteverifyCalls).toEqual([]);
  });

  it('routes /api/feedback to the handler', async () => {
    const response = await exports.default.fetch(URL_OF_ENDPOINT);

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'method' });
  });
});
