import { describe, expect, it } from 'vitest';
import {
  EXPECTED_HOSTNAME,
  EXPECTED_ORIGIN,
  MAX_BODY_BYTES,
  MAX_TOKEN_CHARS,
  checkRequest,
  parseBody,
  readSiteverify,
  type RequestHeaders,
} from '../worker/checks';

const GOOD: RequestHeaders = {
  method: 'POST',
  contentType: 'application/json',
  origin: EXPECTED_ORIGIN,
  secFetchSite: 'same-origin',
  contentLength: '120',
};

const check = (request: RequestHeaders) => checkRequest(request, EXPECTED_ORIGIN);

describe('checkRequest', () => {
  it('accepts a same-origin JSON post', () => {
    expect(check(GOOD)).toBeNull();
  });

  it('accepts a charset parameter and any case in the content type', () => {
    expect(check({ ...GOOD, contentType: 'Application/JSON; charset=utf-8' })).toBeNull();
  });

  it('accepts a missing Sec-Fetch-Site and a missing Content-Length', () => {
    expect(check({ ...GOOD, secFetchSite: null, contentLength: null })).toBeNull();
  });

  it.each(['GET', 'PUT', 'OPTIONS', 'post'])('rejects the method %s', (method) => {
    expect(check({ ...GOOD, method })).toBe('method');
  });

  it.each([null, 'text/plain', 'application/x-www-form-urlencoded', 'application/jsonp'])(
    'rejects the content type %s',
    (contentType) => {
      expect(check({ ...GOOD, contentType })).toBe('content-type');
    },
  );

  it.each([
    null,
    '',
    'null',
    'https://evil.example',
    'http://naciocheck.vgr.cat',
    'https://naciocheck.vgr.cat.evil.example',
    'https://www.naciocheck.vgr.cat',
    'https://naciocheck.vgr.cat/',
  ])('rejects the origin %s', (origin) => {
    expect(check({ ...GOOD, origin })).toBe('origin');
  });

  it.each(['cross-site', 'same-site', 'none', ''])('rejects Sec-Fetch-Site %s', (secFetchSite) => {
    expect(check({ ...GOOD, secFetchSite })).toBe('origin');
  });

  it('rejects a declared length over the cap and accepts the cap itself', () => {
    expect(check({ ...GOOD, contentLength: String(MAX_BODY_BYTES + 1) })).toBe('too-large');
    expect(check({ ...GOOD, contentLength: String(MAX_BODY_BYTES) })).toBeNull();
  });

  it('leaves a malformed Content-Length to the capped body read', () => {
    expect(check({ ...GOOD, contentLength: 'abc' })).toBeNull();
    expect(check({ ...GOOD, contentLength: '-5' })).toBeNull();
  });

  it('takes the expected origin as a parameter', () => {
    const local = 'http://localhost:8787';
    expect(checkRequest({ ...GOOD, origin: local }, local)).toBeNull();
    expect(checkRequest(GOOD, local)).toBe('origin');
  });

  it('rejects the production origin when another one is expected', () => {
    expect(checkRequest({ ...GOOD, origin: EXPECTED_ORIGIN }, 'http://localhost:8787')).toBe(
      'origin',
    );
  });

  it('reports the method before every other problem', () => {
    expect(
      check({
        method: 'GET',
        contentType: 'text/plain',
        origin: null,
        secFetchSite: 'cross-site',
        contentLength: '999999',
      }),
    ).toBe('method');
  });
});

describe('parseBody', () => {
  const body = (value: unknown) => JSON.stringify(value);

  it('returns text and token of a valid body, unchanged', () => {
    expect(parseBody(body({ text: ' Informe\nañadido ', token: 'tok-1' }))).toEqual({
      ok: true,
      text: ' Informe\nañadido ',
      token: 'tok-1',
    });
  });

  it.each([
    ['not JSON', '{nope'],
    ['empty input', ''],
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"text"'],
    ['a missing token', body({ text: 'a' })],
    ['a missing text', body({ token: 't' })],
    ['an extra key', body({ text: 'a', token: 't', extra: 'x' })],
    ['a numeric text', body({ text: 1, token: 't' })],
    ['a numeric token', body({ text: 'a', token: 1 })],
    ['a null token', body({ text: 'a', token: null })],
    ['an empty text', body({ text: '', token: 't' })],
    ['a blank text', body({ text: '  \n ', token: 't' })],
    ['an empty token', body({ text: 'a', token: '' })],
    ['a nested text', body({ text: { value: 'a' }, token: 't' })],
    ['a nested token', body({ text: 'a', token: ['t'] })],
    ['an oversized token', body({ text: 'a', token: 't'.repeat(MAX_TOKEN_CHARS + 1) })],
  ])('rejects %s as bad-body', (_name, raw) => {
    expect(parseBody(raw)).toEqual({ ok: false, error: 'bad-body' });
  });

  it('accepts a token of exactly the maximum length', () => {
    const token = 't'.repeat(MAX_TOKEN_CHARS);
    expect(parseBody(body({ text: 'a', token }))).toEqual({ ok: true, text: 'a', token });
  });

  it('measures the cap in bytes, not characters', () => {
    // 'ñ' is one character and two bytes: this body is under the cap in characters and over it in bytes.
    const text = 'ñ'.repeat(MAX_BODY_BYTES / 2);
    const raw = body({ text, token: 't' });
    expect(raw.length).toBeLessThan(MAX_BODY_BYTES + 40);
    expect(new TextEncoder().encode(raw).byteLength).toBeGreaterThan(MAX_BODY_BYTES);
    expect(parseBody(raw)).toEqual({ ok: false, error: 'too-large' });
  });

  it('rejects an oversized body as too-large even when it is not valid JSON', () => {
    expect(parseBody('x'.repeat(MAX_BODY_BYTES + 1))).toEqual({ ok: false, error: 'too-large' });
  });

  it('accepts a body of exactly the cap', () => {
    const overhead = new TextEncoder().encode(body({ text: '', token: 't' })).byteLength;
    const text = 'a'.repeat(MAX_BODY_BYTES - overhead);
    const raw = body({ text, token: 't' });
    expect(new TextEncoder().encode(raw).byteLength).toBe(MAX_BODY_BYTES);
    expect(parseBody(raw)).toEqual({ ok: true, text, token: 't' });
  });
});

describe('readSiteverify', () => {
  it('passes success for the expected hostname', () => {
    expect(
      readSiteverify(
        { success: true, hostname: EXPECTED_HOSTNAME, 'error-codes': [] },
        EXPECTED_HOSTNAME,
      ),
    ).toBe('ok');
  });

  it.each([
    ['success false', { success: false, hostname: EXPECTED_HOSTNAME }],
    [
      'timeout-or-duplicate',
      { success: false, 'error-codes': ['timeout-or-duplicate'], hostname: EXPECTED_HOSTNAME },
    ],
    ['invalid-input-response', { success: false, 'error-codes': ['invalid-input-response'] }],
    ['a wrong hostname', { success: true, hostname: 'evil.example' }],
    ['a missing hostname', { success: true }],
    ['a hostname with a subdomain', { success: true, hostname: `www.${EXPECTED_HOSTNAME}` }],
    ['a truthy but non-true success', { success: 'true', hostname: EXPECTED_HOSTNAME }],
    ['success 1', { success: 1, hostname: EXPECTED_HOSTNAME }],
    ['an empty object', {}],
    ['null', null],
    ['an array', []],
    ['a string', 'ok'],
    ['undefined', undefined],
  ])('rejects %s as turnstile', (_name, json) => {
    expect(readSiteverify(json, EXPECTED_HOSTNAME)).toBe('turnstile');
  });
});
