import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_CONTENT_SCRIPT_MATCHES,
  EXPECTED_HOST_PERMISSIONS,
  EXPECTED_PERMISSIONS,
  PACKAGE_NOTICE_FILES,
  packageNoticeProblems,
  manifestProblems,
  textProblems,
} from '../scripts/check-privacy.mjs';

/**
 * Negative fixtures for the privacy gate itself. These run offline and do not need a build; the CLI
 * applies the same functions to `.output` after both browser builds.
 */

const ALLOWED = ['https://sede.mjusticia.gob.es/'];

function validManifest(): Record<string, unknown> {
  return {
    manifest_version: 3,
    permissions: [...EXPECTED_PERMISSIONS],
    host_permissions: [...EXPECTED_HOST_PERMISSIONS],
    content_scripts: [{ matches: [...EXPECTED_CONTENT_SCRIPT_MATCHES] }],
  };
}

describe('manifest gate', () => {
  it('accepts the agreed manifest', () => {
    expect(manifestProblems(validManifest())).toEqual([]);
  });

  it('rejects an extra API permission', () => {
    const manifest = validManifest();
    manifest.permissions = [...EXPECTED_PERMISSIONS, 'tabs'];
    expect(manifestProblems(manifest).join('\n')).toContain('permissions');
  });

  it('rejects a broader content-script match', () => {
    const manifest = validManifest();
    manifest.content_scripts = [{ matches: ['<all_urls>'] }];
    expect(manifestProblems(manifest).join('\n')).toContain('content_scripts');
  });

  it.each(['web_accessible_resources', 'externally_connectable', 'update_url', 'sandbox'])(
    'rejects %s',
    (key) => {
      const manifest = validManifest();
      manifest[key] = key === 'update_url' ? 'https://evil.example/update.json' : {};
      expect(manifestProblems(manifest).join('\n')).toContain(key);
    },
  );

  it.each([
    { extension_pages: "script-src 'self' https://evil.example" },
    { extension_pages: "script-src 'self' 'unsafe-eval'" },
  ])('rejects a remote or eval-like CSP', (csp) => {
    const manifest = validManifest();
    manifest.content_security_policy = csp;
    expect(manifestProblems(manifest).join('\n')).toContain('content_security_policy');
  });
});

describe('built-file gate', () => {
  it.each([
    ['fetch', 'fetch("https://evil.example/")'],
    ['WebSocket', 'new WebSocket("wss://evil.example/")'],
    ['EventSource', 'new EventSource("https://evil.example/")'],
    ['sendBeacon', 'navigator.sendBeacon("https://evil.example/")'],
    ['eval', 'eval("alert(1)")'],
  ])('rejects %s', (_label, text) => {
    expect(textProblems('bundle.js', text, ALLOWED).length).toBeGreaterThan(0);
  });

  it('rejects uppercase, protocol-relative and non-HTTP transports', () => {
    expect(textProblems('bundle.js', 'const u = "HTTPS://evil.example/x";', ALLOWED)).not.toEqual(
      [],
    );
    expect(textProblems('bundle.js', 'const u = "//evil.example/x";', ALLOWED)).not.toEqual([]);
    expect(textProblems('bundle.js', 'const u = "ftp://evil.example/x";', ALLOWED)).not.toEqual([]);
  });

  it('does not mistake a line comment for a protocol-relative URL', () => {
    expect(
      textProblems('bundle.js', '// evil.example is only a comment\nconst x = 1;', ALLOWED),
    ).toEqual([]);
  });

  it('accepts the official host', () => {
    expect(
      textProblems(
        'bundle.js',
        'const u = "https://sede.mjusticia.gob.es/eConsultas/inicioNacionalidad";',
        ALLOWED,
      ),
    ).toEqual([]);
  });

  it('rejects remote CSS imports and url() references', () => {
    expect(
      textProblems('styles.css', '@import url("https://evil.example/x.css");', ALLOWED),
    ).not.toEqual([]);
    expect(
      textProblems('styles.css', 'body{background:url(//evil.example/x.png)}', ALLOWED),
    ).not.toEqual([]);
    expect(textProblems('styles.css', 'body{background:url(#local)}', ALLOWED)).toEqual([]);
  });

  it('rejects an unquoted protocol-relative HTML attribute', () => {
    expect(textProblems('page.html', '<a href=//evil.example/>x</a>', ALLOWED)).not.toEqual([]);
  });

  it('accepts a link to the official host', () => {
    expect(
      textProblems(
        'page.html',
        '<a href="https://sede.mjusticia.gob.es/eConsultas/inicioNacionalidad">x</a>',
        ALLOWED,
      ),
    ).toEqual([]);
  });

  it('rejects external SVG references and scripts, but not the SVG namespace', () => {
    expect(
      textProblems('icon.svg', '<image href="https://evil.example/x.png"/>', ALLOWED),
    ).not.toEqual([]);
    expect(
      textProblems('icon.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>', ALLOWED),
    ).toEqual([]);
    expect(textProblems('icon.svg', '<script>alert(1)</script>', ALLOWED)).not.toEqual([]);
    expect(textProblems('icon.svg', '<svg onload="alert(1)"></svg>', ALLOWED)).not.toEqual([]);
  });
});

describe('package notice gate', () => {
  it('requires both canonical files in a build directory', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'naciocheck-notices-'));
    const canonical = { LICENSE: 'GPL text', 'THIRD-PARTY-NOTICES.txt': 'MIT notice' };
    try {
      expect(PACKAGE_NOTICE_FILES).toEqual(['LICENSE', 'THIRD-PARTY-NOTICES.txt']);
      expect((await packageNoticeProblems(directory, canonical, 'build')).join('\n')).toContain(
        'missing',
      );
      writeFileSync(join(directory, 'LICENSE'), 'GPL text');
      writeFileSync(join(directory, 'THIRD-PARTY-NOTICES.txt'), 'MIT notice');
      expect(await packageNoticeProblems(directory, canonical, 'build')).toEqual([]);
      expect(
        (
          await packageNoticeProblems(directory, { ...canonical, LICENSE: 'different' }, 'build')
        ).join('\n'),
      ).toContain('does not match');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
