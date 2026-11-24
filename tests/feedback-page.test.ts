import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runInNewContext, runInThisContext } from 'node:vm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildSite } from '../scripts/build-site.mjs';
import { MAX_BODY_BYTES } from '../worker/checks';

/**
 * The feedback pages, offline: each page's HTML is loaded into jsdom and `site/feedback/feedback.js` runs
 * against it with a fake `turnstile`, a stubbed `fetch` and a fake `location`. Nothing reaches a network.
 */

const SITE = resolve(import.meta.dirname, '../site');
const SCRIPT = readFileSync(resolve(SITE, 'feedback/feedback.js'), 'utf8');

const PAGES = [
  { name: 'es', file: 'feedback/index.html', path: '/feedback/' },
  { name: 'en', file: 'en/feedback/index.html', path: '/en/feedback/' },
  { name: 'ca', file: 'ca/feedback/index.html', path: '/ca/feedback/' },
] as const;

const REAL_SITEKEY = '0x4AAAAAAGPHi96wZq5N-xcv';
const TEST_SITEKEY = '1x00000000000000000000AA';

interface RenderOptions {
  sitekey: string;
  language: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
  'error-callback': () => void;
}

interface FakeTurnstile {
  render: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  getResponse: ReturnType<typeof vi.fn>;
  ready?: ReturnType<typeof vi.fn>;
  options: () => RenderOptions;
}

function fakeTurnstile(withReady = false): FakeTurnstile {
  let captured: RenderOptions | undefined;
  const fake: FakeTurnstile = {
    render: vi.fn((_container: unknown, options: RenderOptions) => {
      captured = options;
      return 'widget-1';
    }),
    reset: vi.fn(),
    getResponse: vi.fn(() => ''),
    options: () => {
      if (!captured) throw new Error('turnstile.render was not called');
      return captured;
    },
  };
  if (withReady) fake.ready = vi.fn((callback: () => void) => callback());
  return fake;
}

interface Harness {
  textarea: HTMLTextAreaElement;
  send: HTMLButtonElement;
  copy: HTMLButtonElement;
  status: HTMLElement;
  fetch: ReturnType<typeof vi.fn>;
  replaceState: ReturnType<typeof vi.fn>;
  window: EventTarget;
  turnstile: FakeTurnstile;
  /** Runs `feedback.js`, as the browser does once the page is parsed. */
  run: () => void;
}

interface Setup {
  hostname?: string;
  hash?: string;
  /** `before`: `turnstile` exists when `feedback.js` runs; `after`: it appears later. */
  turnstile?: 'before' | 'after';
  withReady?: boolean;
}

function load(page: (typeof PAGES)[number], setup: Setup = {}): Harness {
  const html = readFileSync(resolve(SITE, page.file), 'utf8');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.documentElement.lang = parsed.documentElement.lang;
  document.body.innerHTML = parsed.body.innerHTML;

  const fakeWindow = new EventTarget();
  const fetchStub = vi.fn();
  const replaceState = vi.fn();
  const turnstile = fakeTurnstile(setup.withReady);

  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('fetch', fetchStub);
  vi.stubGlobal('history', { replaceState });
  vi.stubGlobal('location', {
    hostname: setup.hostname ?? 'naciocheck.vgr.cat',
    hash: setup.hash ?? '',
    pathname: page.path,
    search: '',
  });
  if ((setup.turnstile ?? 'before') === 'before') vi.stubGlobal('turnstile', turnstile);

  const element = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`#${id} missing from ${page.file}`);
    return found as T;
  };

  return {
    textarea: element<HTMLTextAreaElement>('report'),
    send: element<HTMLButtonElement>('send'),
    copy: element<HTMLButtonElement>('copy'),
    status: element('status'),
    fetch: fetchStub,
    replaceState,
    window: fakeWindow,
    turnstile,
    run: () => {
      runInThisContext(SCRIPT);
    },
  };
}

function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

const flush = async () => {
  await new Promise((resolveTick) => setTimeout(resolveTick, 0));
};

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'clipboard');
  document.body.innerHTML = '';
});

describe('the built feedback theme switcher', () => {
  const key = 'naciocheck-theme';
  const source = readFileSync(resolve(SITE, 'theme.js'), 'utf8');
  let built = '';

  beforeAll(async () => {
    built = mkdtempSync(resolve(tmpdir(), 'naciocheck-feedback-theme-'));
    await buildSite({ sourceDir: SITE, outDir: built, writeAssets: false });
  });

  afterAll(() => {
    if (built) rmSync(built, { recursive: true, force: true });
  });

  function loadTheme(page: (typeof PAGES)[number], initial: string | null, supportsColors = true) {
    const html = readFileSync(resolve(built, page.file), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const radios = [
      ...doc.querySelectorAll<HTMLInputElement>(
        '.site-footer input[type="radio"][name="site-theme"]',
      ),
    ];
    if (radios.length !== 3) throw new Error(`Theme switcher missing from ${page.file}`);
    let saved = initial;
    const localStorage = {
      getItem: vi.fn((requestedKey: string) => (requestedKey === key ? saved : null)),
      setItem: vi.fn((requestedKey: string, choice: string) => {
        if (requestedKey === key) saved = choice;
      }),
    };
    const events = new EventTarget();
    const window = Object.assign(events, { localStorage, CSS: { supports: () => supportsColors } });

    return {
      doc,
      html,
      radios,
      /** The value of the checked radio, or null when none is checked. */
      checkedValue: () => radios.filter((radio) => radio.checked).map((radio) => radio.value),
      localStorage,
      start() {
        // The parsed scripts and resource URLs are inert. Run only the local theme bootstrap.
        runInNewContext(source, { document: doc, window });
      },
      ready() {
        doc.dispatchEvent(new Event('DOMContentLoaded'));
      },
      choose(mode: string) {
        const radio = radios.find((candidate) => candidate.value === mode);
        if (!radio) throw new Error(`No ${mode} radio`);
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      },
      restorePage() {
        events.dispatchEvent(new Event('pageshow'));
      },
      externalChoice(choice: string | null, changedKey: string | null = key) {
        saved = choice;
        events.dispatchEvent(new StorageEvent('storage', { key: changedKey }));
      },
      metaMedia() {
        return [...doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
          (meta) => meta.media,
        );
      },
    };
  }

  it.each(PAGES)('persists a localized selection on the $name feedback page', (page) => {
    const h = loadTheme(page, 'dark');
    expect(h.doc.documentElement.dataset.themeReady).toBeUndefined();
    expect(h.html).toMatch(
      /:root:not\(\[data-theme-ready\]\) \.theme-switch\s*\{\s*visibility: hidden/,
    );
    expect(h.radios.map((radio) => radio.value)).toEqual(['auto', 'light', 'dark']);
    for (const radio of h.radios) expect(radio.labels).toHaveLength(1);
    expect(h.doc.querySelectorAll('header select, #site-theme')).toHaveLength(0);
    expect(h.checkedValue()).toEqual([]);
    for (const selector of ['#report', '#copy', '#send']) {
      expect(h.doc.querySelector(selector)).not.toBeNull();
    }
    h.start();
    expect(h.doc.documentElement.dataset.theme).toBe('dark');
    expect(h.metaMedia()).toEqual(['not all', 'all']);
    expect(h.doc.documentElement.dataset.themeReady).toBeUndefined();
    h.ready();
    expect(h.doc.documentElement.dataset.themeReady).toBe('');
    expect(h.checkedValue()).toEqual(['dark']);

    h.choose('light');
    expect(h.localStorage.setItem).toHaveBeenCalledWith(key, 'light');
    expect(h.doc.documentElement.dataset.theme).toBe('light');
    expect(h.metaMedia()).toEqual(['all', 'not all']);
    h.externalChoice('dark', 'unrelated');
    expect(h.checkedValue()).toEqual(['light']);
    h.restorePage();
    expect(h.checkedValue()).toEqual(['dark']);
    h.externalChoice(null, null);
    expect(h.checkedValue()).toEqual(['auto']);
    expect(h.doc.documentElement.dataset.theme).toBeUndefined();
    expect(h.metaMedia()).toEqual([
      '(prefers-color-scheme: light)',
      '(prefers-color-scheme: dark)',
    ]);
  });

  it('defaults to Auto for an invalid stored value', () => {
    const h = loadTheme(PAGES[0], 'sepia');
    h.start();
    h.ready();
    expect(h.checkedValue()).toEqual(['auto']);
    expect(h.doc.documentElement.dataset.theme).toBeUndefined();
  });

  it('saves only a radio that is checked and keeps exactly one checked', () => {
    const h = loadTheme(PAGES[0], 'light');
    h.start();
    h.ready();
    expect(h.checkedValue()).toEqual(['light']);
    const dark = h.radios.find((radio) => radio.value === 'dark');
    dark?.dispatchEvent(new Event('change', { bubbles: true }));
    expect(h.localStorage.setItem).not.toHaveBeenCalled();
    expect(h.doc.documentElement.dataset.theme).toBe('light');
    for (const mode of ['dark', 'auto', 'light']) {
      h.choose(mode);
      expect(h.checkedValue()).toEqual([mode]);
    }
    expect(h.localStorage.setItem).toHaveBeenLastCalledWith(key, 'light');
  });

  it.each([true, false])('keeps an unsaved selection when reads fail: %s', (readDenied) => {
    const h = loadTheme(PAGES[0], null);
    const denied = () => {
      throw new Error('Storage unavailable');
    };
    h.localStorage.setItem.mockImplementation(denied);
    if (readDenied) h.localStorage.getItem.mockImplementation(denied);
    h.start();
    h.ready();
    expect(h.checkedValue()).toEqual(['auto']);
    h.choose('dark');
    h.restorePage();
    expect(h.checkedValue()).toEqual(['dark']);
    expect(h.doc.documentElement.dataset.theme).toBe('dark');
    expect(h.metaMedia()).toEqual(['not all', 'all']);
  });

  it('uses light metadata when the browser needs the light fallback palette', () => {
    const h = loadTheme(PAGES[0], 'dark', false);
    h.start();
    h.ready();
    expect(h.checkedValue()).toEqual(['dark']);
    expect(h.metaMedia()).toEqual(['all', 'not all']);
    h.choose('auto');
    expect(h.metaMedia()).toEqual(['all', 'not all']);
  });
});

describe.each(PAGES)('feedback page ($name)', (page) => {
  it('carries the labelled textarea, the buttons and a live status line', () => {
    const h = load(page);
    expect(document.querySelector('label[for="report"]')?.textContent).toBeTruthy();
    expect(h.textarea.id).toBe('report');
    expect(h.status.getAttribute('aria-live')).toBe('polite');
    expect(document.getElementById('feedback-widget')?.getAttribute('data-sitekey')).toBe(
      REAL_SITEKEY,
    );
    expect(document.querySelector('.cf-turnstile')).toBeNull();
  });

  it('puts the fragment into the textarea and removes it from the address', () => {
    const report = 'Versión: 0.1.0\nResultado: error\n[NIE] ñ & é';
    const h = load(page, { hash: `#${encodeURIComponent(report)}` });
    h.run();
    expect(h.textarea.value).toBe(report);
    expect(h.replaceState).toHaveBeenCalledOnce();
    expect(h.replaceState).toHaveBeenCalledWith(null, '', page.path);
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('ignores a malformed fragment but still removes it', () => {
    const h = load(page, { hash: '#%E0%A4%A' });
    h.run();
    expect(h.textarea.value).toBe('');
    expect(h.replaceState).toHaveBeenCalledOnce();
  });

  it('leaves the address alone when there is no fragment', () => {
    const h = load(page);
    h.run();
    expect(h.replaceState).not.toHaveBeenCalled();
  });

  it('posts the edited text and the token once, and only on a click', async () => {
    const h = load(page, { hash: `#${encodeURIComponent('original')}` });
    h.run();
    h.fetch.mockResolvedValue(new Response(null, { status: 204 }));
    h.turnstile.options().callback('token-1');

    await flush();
    expect(h.fetch).not.toHaveBeenCalled();

    h.textarea.value = 'edited text';
    h.send.click();
    await flush();

    expect(h.fetch).toHaveBeenCalledOnce();
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/feedback');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ text: 'edited text', token: 'token-1' });

    // A success asks for a fresh token and keeps Send off until the text changes.
    expect(h.turnstile.reset).toHaveBeenCalledWith('widget-1');
    expect(h.send.disabled).toBe(true);
    expect(h.status.textContent).not.toBe('');
    h.send.click();
    await flush();
    expect(h.fetch).toHaveBeenCalledOnce();
    h.textarea.dispatchEvent(new Event('input'));
    expect(h.send.disabled).toBe(false);
  });

  it('reads the token from getResponse when the callback has not run', async () => {
    const h = load(page);
    h.run();
    h.turnstile.getResponse.mockReturnValue('from-get-response');
    h.fetch.mockResolvedValue(new Response(null, { status: 204 }));
    h.textarea.value = 'hello';
    h.send.click();
    await flush();
    const [, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ token: 'from-get-response' });
  });

  it('checks the serialized UTF-8 body size and keeps an oversized draft and token for retry', async () => {
    const h = load(page);
    h.run();
    const token = 'token';
    h.turnstile.options().callback(token);
    // Quotes, backslashes, and multibyte characters exercise JSON escaping and UTF-8 byte counting.
    h.textarea.value = `${'界'.repeat(3000)}\\"😀`;
    const oversized = JSON.stringify({ text: h.textarea.value, token });
    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(MAX_BODY_BYTES);

    h.send.click();
    await flush();

    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.textarea.value).toContain('界');
    expect(h.turnstile.reset).not.toHaveBeenCalled();
    expect(h.status.textContent).toMatch(/too long|demasiado largo|massa llarg/i);
    expect(h.send.disabled).toBe(false);

    // The same token can retry after the person shortens the draft.
    h.textarea.value = 'shortened';
    h.fetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    h.send.click();
    await flush();
    const [, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ text: 'shortened', token });
  });

  it('posts a body whose serialized UTF-8 representation is exactly the Worker limit', async () => {
    const h = load(page);
    h.run();
    const token = 'token';
    h.turnstile.options().callback(token);
    const overhead = new TextEncoder().encode(JSON.stringify({ text: '', token })).byteLength;
    h.textarea.value = 'a'.repeat(MAX_BODY_BYTES - overhead);
    const body = JSON.stringify({ text: h.textarea.value, token });
    expect(new TextEncoder().encode(body).byteLength).toBe(MAX_BODY_BYTES);
    h.fetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    h.send.click();
    await flush();

    expect(h.fetch).toHaveBeenCalledOnce();
    expect((h.fetch.mock.calls[0]?.[1] as RequestInit).body).toBe(body);
  });

  it('does not post without a token or without text', async () => {
    const h = load(page);
    h.run();
    h.textarea.value = 'hello';
    h.send.click();
    await flush();
    expect(h.fetch).not.toHaveBeenCalled();
    const noToken = h.status.textContent;
    expect(noToken).toBeTruthy();

    h.turnstile.options().callback('token-1');
    h.textarea.value = '   \n';
    h.send.click();
    await flush();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.status.textContent).not.toBe(noToken);
  });

  it('shows a distinct message per error code and resets the widget after each failure', async () => {
    const codes = [
      [400, 'bad-body'],
      [403, 'origin'],
      [403, 'turnstile'],
      [405, 'method'],
      [413, 'too-large'],
      [415, 'content-type'],
      [429, 'rate-limited'],
      [502, 'upstream'],
    ] as const;
    const h = load(page);
    h.run();
    const messages = new Set<string>();
    for (const [status, code] of codes) {
      h.fetch.mockResolvedValueOnce(Response.json({ error: code }, { status }));
      h.turnstile.options().callback('token');
      h.textarea.value = 'text';
      h.turnstile.reset.mockClear();
      h.send.click();
      await flush();
      const message = h.status.textContent ?? '';
      expect(message, code).not.toBe('');
      expect(messages.has(message), `${code} repeats a message`).toBe(false);
      messages.add(message);
      expect(h.turnstile.reset, code).toHaveBeenCalledOnce();
      expect(h.send.disabled, code).toBe(false);
    }
    expect(h.fetch).toHaveBeenCalledTimes(codes.length);
  });

  it('falls back to the status when the body has no known code', async () => {
    const h = load(page);
    h.run();
    h.turnstile.options().callback('token');
    h.textarea.value = 'text';

    h.fetch.mockResolvedValueOnce(new Response('not json', { status: 429 }));
    h.turnstile.options().callback('token');
    h.send.click();
    await flush();
    const limited = h.status.textContent;

    h.fetch.mockResolvedValueOnce(Response.json({ error: 'rate-limited' }, { status: 429 }));
    h.turnstile.options().callback('token');
    h.send.click();
    await flush();
    expect(h.status.textContent).toBe(limited);

    h.fetch.mockResolvedValueOnce(new Response('<html>', { status: 404 }));
    h.turnstile.options().callback('token');
    h.send.click();
    await flush();
    expect(h.status.textContent).toBeTruthy();
    expect(h.status.textContent).not.toBe(limited);
    expect(h.send.disabled).toBe(false);
  });

  it('reports a network failure and lets the person try again', async () => {
    const h = load(page);
    h.run();
    h.turnstile.options().callback('token');
    h.textarea.value = 'text';
    h.fetch.mockRejectedValueOnce(new TypeError('offline'));
    h.send.click();
    await flush();
    expect(h.status.textContent).toBeTruthy();
    expect(h.send.disabled).toBe(false);
    expect(h.turnstile.reset).toHaveBeenCalledOnce();
  });

  it('copies the edited text without a token, and without Turnstile at all', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const h = load(page, { turnstile: 'after' });
    h.run();
    h.textarea.value = 'what the person sees';
    h.copy.click();
    await flush();
    expect(writeText).toHaveBeenCalledExactlyOnceWith('what the person sees');
    expect(h.status.textContent).toBeTruthy();
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('says so when copying fails', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    try {
      const h = load(page);
      h.run();
      h.textarea.value = 'text';
      h.copy.click();
      await flush();
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(h.status.textContent).toBeTruthy();
    } finally {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });

  it('renders with the real key on the production host and the test key elsewhere', () => {
    const production = load(page, { hostname: 'naciocheck.vgr.cat' });
    production.run();
    expect(production.turnstile.options().sitekey).toBe(REAL_SITEKEY);
    expect(production.turnstile.options().language).toBe(page.name);

    vi.unstubAllGlobals();
    const local = load(page, { hostname: 'localhost' });
    local.run();
    expect(local.turnstile.options().sitekey).toBe(TEST_SITEKEY);

    vi.unstubAllGlobals();
    const lookalike = load(page, { hostname: 'naciocheck.vgr.cat.evil.example' });
    lookalike.run();
    expect(lookalike.turnstile.options().sitekey).toBe(TEST_SITEKEY);
  });

  it('renders the widget once when turnstile exists before the script runs', () => {
    const h = load(page, { turnstile: 'before' });
    h.run();
    h.window.dispatchEvent(new Event('load'));
    expect(h.turnstile.render).toHaveBeenCalledOnce();
    expect(h.turnstile.render.mock.calls[0]?.[0]).toBe(document.getElementById('feedback-widget'));
  });

  it('renders the widget once when turnstile appears after the script runs', () => {
    const h = load(page, { turnstile: 'after' });
    h.run();
    expect(h.turnstile.render).not.toHaveBeenCalled();

    vi.stubGlobal('turnstile', h.turnstile);
    document
      .querySelector('script[src*="challenges.cloudflare.com"]')
      ?.dispatchEvent(new Event('load'));
    h.window.dispatchEvent(new Event('load'));
    expect(h.turnstile.render).toHaveBeenCalledOnce();
  });

  it('ignores a page element named turnstile until the real API arrives', () => {
    // Browsers expose an element with id="turnstile" as a global of that name; it is not the API.
    const h = load(page, { turnstile: 'after' });
    const impostor = document.createElement('div');
    impostor.id = 'turnstile';
    document.body.append(impostor);
    vi.stubGlobal('turnstile', impostor);
    expect(() => {
      h.run();
    }).not.toThrow();
    expect(h.turnstile.render).not.toHaveBeenCalled();

    vi.stubGlobal('turnstile', h.turnstile);
    document
      .querySelector('script[src*="challenges.cloudflare.com"]')
      ?.dispatchEvent(new Event('load'));
    expect(h.turnstile.render).toHaveBeenCalledOnce();
  });

  it('has no element whose id would shadow the turnstile global', () => {
    load(page);
    expect(document.getElementById('turnstile')).toBeNull();
  });

  it('never calls turnstile.ready, which throws for an async api.js, and still renders once', () => {
    const h = load(page, { withReady: true });
    h.run();
    expect(h.turnstile.ready).not.toHaveBeenCalled();
    expect(h.turnstile.render).toHaveBeenCalledOnce();
  });

  it('tells the person when the widget never loads, and Copy still works', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const h = load(page, { turnstile: 'after' });
    h.run();
    h.window.dispatchEvent(new Event('load'));
    expect(h.status.textContent).toBeTruthy();
    h.textarea.value = 'text';
    h.copy.click();
    await flush();
    expect(writeText).toHaveBeenCalledWith('text');
  });

  it('shows the widget error and forgets a spent or expired token', async () => {
    const h = load(page);
    h.run();
    const options = h.turnstile.options();
    options.callback('token');
    options['expired-callback']();
    h.textarea.value = 'text';
    h.send.click();
    await flush();
    expect(h.fetch).not.toHaveBeenCalled();

    options['error-callback']();
    expect(h.status.textContent).toBeTruthy();
  });
});

describe('feedback pages: content', () => {
  it.each(PAGES)('$name page links home, privacy and the Turnstile addendum', (page) => {
    const html = readFileSync(resolve(SITE, page.file), 'utf8');
    const home = { es: '/', en: '/en/', ca: '/ca/' }[page.name];
    const privacy = { es: '/privacy/', en: '/en/privacy/', ca: '/ca/privacy/' }[page.name];
    expect(html).toContain(`href="${home}"`);
    expect(html).toContain(`href="${privacy}"`);
    expect(html).toContain('href="https://www.cloudflare.com/turnstile-privacy-policy/"');
    expect(html).toMatch(/Turnstile/);
  });

  it.each(PAGES)('$name page says comments may be in Catalan, Spanish or English', (page) => {
    const html = readFileSync(resolve(SITE, page.file), 'utf8');
    expect(html).toMatch(
      {
        es: /catalán, castellano o inglés/,
        en: /Catalan, Spanish or English/,
        ca: /català, castellà o anglès/,
      }[page.name],
    );
  });

  it.each(PAGES)('$name page never claims to be official', (page) => {
    const html = readFileSync(resolve(SITE, page.file), 'utf8');
    expect(html).toMatch(
      {
        es: /no es un canal oficial/,
        en: /not an official channel/,
        ca: /no és un canal oficial/,
      }[page.name],
    );
  });

  it.each(PAGES)('$name page speaks its own language when a code comes back', async (page) => {
    const h = load(page);
    h.run();
    h.fetch.mockResolvedValueOnce(Response.json({ error: 'rate-limited' }, { status: 429 }));
    h.turnstile.options().callback('token');
    h.textarea.value = 'text';
    h.send.click();
    await flush();
    expect(h.status.textContent).toMatch(
      {
        es: /Demasiados envíos/,
        en: /Too many sends/,
        ca: /Massa enviaments/,
      }[page.name],
    );
  });

  it('feedback.js names no address and exactly one test key', () => {
    expect(SCRIPT).not.toMatch(/https?:\/\//);
    expect(SCRIPT.match(new RegExp(TEST_SITEKEY, 'g'))).toHaveLength(1);
    expect(SCRIPT).toContain("'/api/feedback'");
  });
});

describe('privacy pages: disclosures', () => {
  const PRIVACY = [
    { name: 'es', file: 'privacy/index.html' },
    { name: 'en', file: 'en/privacy/index.html' },
    { name: 'ca', file: 'ca/privacy/index.html' },
  ] as const;

  it.each(PRIVACY)('$name policy names Turnstile, the mailbox and Web Analytics', ({ file }) => {
    const html = readFileSync(resolve(SITE, file), 'utf8');
    expect(html).toContain('href="https://www.cloudflare.com/turnstile-privacy-policy/"');
    expect(html).toContain('naciocheck@vgr.cat');
    expect(html).toContain('Cloudflare Turnstile');
    expect(html).toContain('Cloudflare Web Analytics');
    expect(html).toContain('<code>storage.local</code>');
  });

  it.each([
    { name: 'es', file: 'privacy/index.html', route: '/feedback/' },
    { name: 'en', file: 'en/privacy/index.html', route: '/en/feedback/' },
    { name: 'ca', file: 'ca/privacy/index.html', route: '/ca/feedback/' },
  ] as const)('$name policy names its feedback page as the contact route', ({ file, route }) => {
    const html = readFileSync(resolve(SITE, file), 'utf8');
    const contact = html.slice(html.search(/<h2 id="(?:contact|contacto|contacte)">/));
    expect(contact).toContain(`href="${route}"`);
    expect(contact).toContain('naciocheck@vgr.cat');
    expect(contact).toMatch(/Cloudflare/);
  });

  it.each(PRIVACY)(
    '$name policy mentions the repository only inside @if repository',
    ({ file }) => {
      const html = readFileSync(resolve(SITE, file), 'utf8');
      const outside = html.replace(/<!-- @if repository -->[\s\S]*?<!-- @endif -->/g, '');
      expect(outside).not.toMatch(/github\.com/i);
      expect(outside).not.toMatch(/repositor(?:y|io|i)\b/i);
      expect(html).toMatch(/<!-- @if repository -->[\s\S]*?github\.com[\s\S]*?<!-- @endif -->/);
      expect(html.match(/@if repository/g)).toHaveLength(html.match(/@endif/g)?.length ?? -1);
    },
  );

  it.each(PRIVACY)(
    '$name policy is in its own language and carries the markers',
    ({ name, file }) => {
      const html = readFileSync(resolve(SITE, file), 'utf8');
      expect(html).toContain(`<html lang="${name}">`);
      for (const marker of ['@head', '@style', '@header', '@footer']) {
        expect(html).toContain(`<!-- ${marker} -->`);
      }
      expect(html.match(/<h1>/g)).toHaveLength(1);
    },
  );
});
