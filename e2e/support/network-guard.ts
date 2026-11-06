import { browser } from '@wdio/globals';

/** What `browser.mock()` hands back, derived from the API so no global namespace is needed. */
type Mock = Awaited<ReturnType<typeof browser.mock>>;

/**
 * Schemes that stay on the machine: the extension itself, and what the browser opens by itself.
 * Everything else — every `http:` and `https:` request a page makes — is a privacy violation in this
 * project, so the guard blocks it and fails the test that provoked it.
 */
const LOCAL_PREFIXES = ['chrome-extension://', 'moz-extension://', 'about:', 'data:', 'blob:'];

/**
 * Blocks every network request the suite did not ask for, and reports what it blocked.
 *
 * The suite runs against fake pages served at the real URLs, so anything that escapes the mocks would
 * reach the official site or reCAPTCHA. `afterTest` calls `assertClean()`, which turns any escape into a
 * test failure instead of a silent request.
 *
 * Requests are recorded from the mocks' own `request` event: an aborted request never completes, so
 * `mock.calls` — which only collects completed responses — would not see it.
 */
export class NetworkGuard {
  #mocks: Mock[] = [];
  #requested = new Set<string>();
  #exempt: string[] = [];

  /**
   * Declare a URL prefix the test answers itself (the fake sede, the captcha stub).
   *
   * The test's own mock has to be registered *before* `install()`: WebdriverIO's arbiter prefers the
   * mock registered first, so the catch-all must be the newest intercept of the session.
   */
  exempt(urlPrefix: string): void {
    this.#exempt.push(urlPrefix);
  }

  /** Block every remaining `http(s)` request of this session. */
  async install(): Promise<void> {
    await this.restore();
    for (const scheme of ['http', 'https'] as const) {
      const mock = await browser.mock(`${scheme}://*`);
      mock.on('request', (request) => {
        this.#requested.add(request.request.url);
      });
      mock.abort();
      this.#mocks.push(mock);
    }
  }

  /** Every URL requested during the test, without the local schemes and the exemptions. */
  requested(): string[] {
    return [...this.#requested].filter((url) => !this.#isAllowed(url));
  }

  /** Fails when anything left the machine during the test. */
  assertClean(): void {
    const urls = this.requested();
    if (urls.length > 0) {
      throw new Error(
        `Network guard: ${urls.length} unexpected request(s) left the machine: ${urls.join(', ')}`,
      );
    }
  }

  /** Drops the mocks so the next test starts from a clean session. */
  async restore(): Promise<void> {
    for (const mock of this.#mocks) await mock.restore();
    this.#mocks = [];
    this.#requested = new Set();
    this.#exempt = [];
  }

  #isAllowed(url: string): boolean {
    const prefixes = [...LOCAL_PREFIXES, ...this.#exempt];
    return prefixes.some((prefix) => url.startsWith(prefix));
  }
}

/**
 * The one guard of a worker process: the WDIO config installs it, the Mocha hooks assert it.
 *
 * It lives on `globalThis` because WDIO loads the config and Mocha loads the spec files through different
 * module registries, so a module-scoped singleton would be two objects that never see each other.
 */
const GUARD_KEY = '__naciocheckNetworkGuard';

type GuardHolder = { [GUARD_KEY]?: NetworkGuard };

export function networkGuard(): NetworkGuard {
  const holder = globalThis as unknown as GuardHolder;
  holder[GUARD_KEY] ??= new NetworkGuard();
  return holder[GUARD_KEY];
}
