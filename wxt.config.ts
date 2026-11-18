import { defineConfig } from 'wxt';

/**
 * The settled host scope: the official eConsultas subtree used by the nationality procedure.
 * Anything else is a privacy violation — see `scripts/check-privacy.mjs`.
 */
export const SEDE_HOST_PATTERN = 'https://sede.mjusticia.gob.es/eConsultas/*';

/**
 * The gecko id can never change after the first upload to addons.mozilla.org.
 * See `brand/README.md`.
 */
export const GECKO_ID = 'naciocheck@vgr.cat';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  // Keep the exact runtime pin in source archives without enabling other hidden/local files.
  zip: { includeSources: ['**/*', '.nvmrc'] },
  // Vite's modulepreload polyfill injects a `fetch()` into every page bundle. Supported browsers have
  // modulepreload natively, and the privacy gate forbids `fetch(` anywhere — correctly, so the polyfill goes.
  vite: () => ({
    build: {
      modulePreload: { polyfill: false },
    },
  }),
  manifest: ({ browser }) => ({
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'es',
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: [SEDE_HOST_PATTERN],
    // The action carries the popup and the badge set by the change alert.
    action: {},
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: GECKO_ID,
              strict_min_version: '128.0',
              // Firefox requires this for every new extension since 2025-11-03.
              // "none" states the privacy model literally: no data is collected.
              data_collection_permissions: { required: ['none'] },
            },
            gecko_android: {},
          },
        }
      : {}),
  }),
});
