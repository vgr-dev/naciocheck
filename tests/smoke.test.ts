import { describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';

describe('extension test environment', () => {
  it('provides a fake browser with working local storage', async () => {
    await browser.storage.local.set({ probe: 'value' });

    await expect(browser.storage.local.get('probe')).resolves.toEqual({ probe: 'value' });
  });
});
