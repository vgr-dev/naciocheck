/**
 * The decisions of `POST /api/feedback` as pure functions. No Workers-runtime import, no DOM type, no
 * `fetch`: the handler (`worker/feedback.ts`) reads the request and calls these, so every branch runs under
 * the plain Vitest project.
 */

/** The production defaults; the Worker reads the live values from `vars` in `wrangler.jsonc`. */
export const EXPECTED_ORIGIN = 'https://naciocheck.vgr.cat';
export const EXPECTED_HOSTNAME = 'naciocheck.vgr.cat';
/** Largest accepted request body, in bytes (the report itself is capped far below this). */
export const MAX_BODY_BYTES = 8192;
/** Cloudflare documents Turnstile tokens as at most 2048 characters. */
export const MAX_TOKEN_CHARS = 2048;

/** The codes of the endpoint's contract that the request checks can produce. */
export type RequestError = 'method' | 'content-type' | 'origin' | 'too-large';
export type BodyError = 'bad-body' | 'too-large';

export interface RequestHeaders {
  method: string;
  contentType: string | null;
  origin: string | null;
  secFetchSite: string | null;
  /** The raw `Content-Length` header; a missing or malformed value is left to the capped body read. */
  contentLength: string | null;
}

/**
 * `null` when the request may go on, otherwise the first failing code. `expectedOrigin` comes from the
 * environment (`EXPECTED_ORIGIN` in production, a localhost origin under `wrangler dev`).
 */
export function checkRequest(request: RequestHeaders, expectedOrigin: string): RequestError | null {
  if (request.method !== 'POST') return 'method';
  // A browser always sends Origin on a cross-origin or same-origin POST; a missing one is not our page.
  if (request.origin !== expectedOrigin) return 'origin';
  if (request.secFetchSite !== null && request.secFetchSite !== 'same-origin') return 'origin';
  if (!isJson(request.contentType)) return 'content-type';
  if (request.contentLength !== null && /^\d+$/.test(request.contentLength.trim())) {
    if (Number(request.contentLength.trim()) > MAX_BODY_BYTES) return 'too-large';
  }
  return null;
}

function isJson(contentType: string | null): boolean {
  if (contentType === null) return false;
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}

export type ParsedBody =
  { ok: true; text: string; token: string } | { ok: false; error: BodyError };

/** Validates the raw body text: exactly `{ "text": string, "token": string }`, both non-empty. */
export function parseBody(raw: string): ParsedBody {
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, error: 'too-large' };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'bad-body' };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: 'bad-body' };
  }
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes('text') || !keys.includes('token')) {
    return { ok: false, error: 'bad-body' };
  }
  const { text, token } = value as Record<string, unknown>;
  if (typeof text !== 'string' || typeof token !== 'string') {
    return { ok: false, error: 'bad-body' };
  }
  if (text.trim() === '' || token === '' || token.length > MAX_TOKEN_CHARS) {
    return { ok: false, error: 'bad-body' };
  }
  return { ok: true, text, token };
}

/**
 * Reads Turnstile's siteverify answer. Only `success === true` for the expected hostname passes; anything
 * else, including `timeout-or-duplicate` and a malformed answer, is `turnstile`.
 */
export function readSiteverify(json: unknown, expectedHostname: string): 'ok' | 'turnstile' {
  if (typeof json !== 'object' || json === null) return 'turnstile';
  const answer = json as Record<string, unknown>;
  if (answer['success'] !== true) return 'turnstile';
  if (answer['hostname'] !== expectedHostname) return 'turnstile';
  return 'ok';
}
