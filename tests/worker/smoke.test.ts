import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Worker harness', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers 404 to an unknown /api path without any outbound request', async () => {
    const outbound = vi.spyOn(globalThis, 'fetch');

    const response = await exports.default.fetch('https://naciocheck.vgr.cat/api/anything');

    expect(response.status).toBe(404);
    expect(outbound).not.toHaveBeenCalled();
  });
});
