/**
 * `POST /api/feedback`: checks the request, the rate limit and the Turnstile token, then mails the redacted
 * text to the project's public address. Nothing is stored and nothing about the request is logged: no
 * `console.*` call appears in this file, so neither the text nor the token can reach a log.
 */
import { redact } from '../src/core/redact';
import { MAX_BODY_BYTES, checkRequest, parseBody, readSiteverify } from './checks';
import type { Env } from './index';

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
/** The project's public address (spec F1): the binding's only destination, and the sender. */
export const FEEDBACK_ADDRESS = 'naciocheck@vgr.cat';
export const FEEDBACK_SUBJECT = 'NacioCheck feedback';

/** Every error code of the endpoint's contract, with its status. */
const STATUS_OF = {
  'bad-body': 400,
  origin: 403,
  turnstile: 403,
  method: 405,
  'too-large': 413,
  'content-type': 415,
  'rate-limited': 429,
  upstream: 502,
} as const;

export type FeedbackError = keyof typeof STATUS_OF;

export function errorResponse(code: FeedbackError | 'not-found'): Response {
  const status = code === 'not-found' ? 404 : STATUS_OF[code];
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Reads the body as text, giving up as soon as it passes the cap (a `Content-Length` can lie or be absent). */
async function readCapped(request: Request): Promise<string | null> {
  if (request.body === null) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const result: ReadableStreamReadResult<Uint8Array> = await reader.read();
    if (result.done) break;
    const chunk = result.value;
    total += chunk.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Asks Turnstile about the token. `'upstream'` for an outage, a non-2xx answer or an unreadable one. */
async function verifyToken(
  env: Env,
  token: string,
  ip: string | null,
): Promise<'ok' | 'turnstile' | 'upstream'> {
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip !== null) form.set('remoteip', ip);
  let json: unknown;
  try {
    const answer = await fetch(SITEVERIFY_URL, { method: 'POST', body: form });
    if (!answer.ok) return 'upstream';
    json = await answer.json();
  } catch {
    return 'upstream';
  }
  return readSiteverify(json, env.TURNSTILE_EXPECTED_HOSTNAME);
}

export async function handleFeedback(request: Request, env: Env): Promise<Response> {
  const rejected = checkRequest(
    {
      method: request.method,
      contentType: request.headers.get('Content-Type'),
      origin: request.headers.get('Origin'),
      secFetchSite: request.headers.get('Sec-Fetch-Site'),
      contentLength: request.headers.get('Content-Length'),
    },
    env.FEEDBACK_ORIGIN,
  );
  if (rejected !== null) return errorResponse(rejected);

  const ip = request.headers.get('CF-Connecting-IP');
  const limit = await env.FEEDBACK_LIMIT.limit({ key: ip ?? 'unknown' });
  if (!limit.success) return errorResponse('rate-limited');

  const raw = await readCapped(request);
  if (raw === null) return errorResponse('too-large');
  const body = parseBody(raw);
  if (!body.ok) return errorResponse(body.error);

  const verdict = await verifyToken(env, body.token, ip);
  if (verdict !== 'ok') return errorResponse(verdict);

  try {
    // The structured overload of workers-types: Cloudflare builds the MIME message (UTF-8) from these fields.
    await env.FEEDBACK_MAIL.send({
      from: FEEDBACK_ADDRESS,
      to: FEEDBACK_ADDRESS,
      subject: FEEDBACK_SUBJECT,
      text: redact(body.text),
    });
  } catch {
    return errorResponse('upstream');
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
