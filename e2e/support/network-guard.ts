import { browser } from '@wdio/globals';

/**
 * Schemes that stay on the machine: the extension itself, and what the browser opens by itself.
 * Everything else — every `http:` and `https:` request a page makes — is a privacy violation in this
 * project.
 */
const LOCAL_PREFIXES = ['chrome-extension://', 'moz-extension://', 'about:', 'data:', 'blob:'];

/** The part of a WebDriver BiDi request event the guard reads. */
interface BeforeRequestSent {
  readonly request: { readonly url: string };
}

/**
 * Watches every request the browser makes and fails the test that provoked one outside the fake site.
 *
 * The suite intercepts nothing: Chrome is started with `--host-resolver-rules`, which points the three hosts
 * the captured pages use at a local server and resolves every other host to `NOTFOUND`, so no request can
 * leave the machine. This guard is the evidence for that (D10). It is an observer on WebDriver BiDi's
 * `network.beforeRequestSent`, and a request that is not local and not on a mapped host fails the test.
 */
export class NetworkGuard {
  #allowedHosts: string[] = [];
  #unexpected: string[] = [];
  #listening = false;
  /** Totals for the whole run: `reset()` clears a test, never the run. */
  #seen = 0;
  #served = 0;
  #outside = 0;

  /**
   * Starts watching. Called once per session, once the fake site is listening.
   *
   * `allowedHosts` are the only hosts the browser may reach; anything else is reported to the test that asked
   * for it.
   */
  async attach(allowedHosts: readonly string[]): Promise<void> {
    this.#allowedHosts = [...allowedHosts];
    if (this.#listening) return;
    this.#listening = true;
    await browser.sessionSubscribe({ events: ['network.beforeRequestSent'] });
    browser.on('network.beforeRequestSent', (event: BeforeRequestSent) => {
      this.#observe(event.request.url);
    });
  }

  /** Clears what the current test saw; the run totals stay. */
  reset(): void {
    this.#unexpected = [];
  }

  /** Records a request the fake site refused, so it is reported exactly like a host outside it. */
  noteUnexpected(url: string): void {
    this.#seen += 1;
    this.#outside += 1;
    this.#unexpected.push(url);
  }

  /**
   * Returns the requests of the current test that went outside the fake site, and forgets them.
   *
   * A test that expects one — the leak probe — takes it, checks it and passes; the run summary keeps counting
   * only what no test accounted for.
   */
  takeUnexpected(): string[] {
    const urls = this.#unexpected;
    this.#unexpected = [];
    this.#outside -= urls.length;
    return urls;
  }

  /** Fails the current test when a request went anywhere but the fake site. */
  assertClean(): void {
    if (this.#unexpected.length > 0) {
      throw new Error(
        `Network guard: ${this.#unexpected.length} request(s) went outside the fake site: ${this.#unexpected.join(', ')}`,
      );
    }
  }

  /** One line for the run, printed by the config once every test is over. */
  summary(): string {
    return `Network guard: seen ${this.#seen}, answered by the fake site ${this.#served}, outside it ${this.#outside}`;
  }

  #observe(url: string): void {
    if (LOCAL_PREFIXES.some((prefix) => url.startsWith(prefix))) return;
    this.#seen += 1;

    const host = hostOf(url);
    if (host !== null && this.#allowedHosts.includes(host)) {
      this.#served += 1;
      return;
    }
    this.#outside += 1;
    this.#unexpected.push(url);
  }
}

/** The host of a URL, or `null` when it cannot be parsed (which is reported as outside the fake site). */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * The one guard of a worker process: the WDIO config attaches it, the Mocha hooks assert it.
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
