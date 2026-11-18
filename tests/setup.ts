/**
 * jsdom has no Web Locks API. The store uses `navigator.locks.request` so that read-modify-write operations
 * from the background worker and from extension pages cannot interleave; this mock provides the same
 * exclusive, per-name serialisation in tests instead of silently letting every test run unlocked.
 */

type LockCallback<T> = () => T | Promise<T>;

interface LockManagerMock {
  request<T>(name: string, callback: LockCallback<T>): Promise<T>;
}

/** The tail of the queue for each lock name. A request waits for the previous tail, then takes the lock. */
const tails = new Map<string, Promise<void>>();

const locks: LockManagerMock = {
  async request<T>(name: string, callback: LockCallback<T>): Promise<T> {
    const previous = tails.get(name) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(
      () => held,
      () => held,
    );
    tails.set(name, tail);

    await previous.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await callback();
    } finally {
      release();
      if (tails.get(name) === tail) tails.delete(name);
    }
  },
};

Object.defineProperty(globalThis.navigator, 'locks', {
  configurable: true,
  value: locks,
});
