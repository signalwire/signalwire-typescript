/**
 * Tests for scripts/inject-navbar.ts, which adds the SignalWire docs navbar
 * to every page of the generated API reference.
 *
 * Also checks that reference/navbar/ stays free of TypeDoc: the directory is
 * meant to move to a shared repo for every SDK's reference unchanged, so
 * anything TypeDoc-specific belongs in reference/typedoc-navbar.* instead.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectPage, injectSite, rootPrefix } from '../scripts/inject-navbar.js';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const NAVBAR_DIR = join(REPO, 'reference/navbar');

const FRAGMENT = [
  '<!-- comment -->',
  '<sw-docs-navbar><template shadowrootmode="open">',
  '<img src="%NAVBAR%img/logo.svg">',
  '</template></sw-docs-navbar>',
].join('\n');
const HEAD = ['navbar/document.css', 'assets/adapter.js', 'navbar/navbar.js'];
const PAGE = '<html><head><title>x</title></head><body><main>$& page</main></body></html>';

describe('rootPrefix', () => {
  it('is ./ for a page at the site root', () => {
    expect(rootPrefix('/site/index.html', '/site')).toBe('./');
  });

  it('climbs one level per directory', () => {
    expect(rootPrefix('/site/classes/A.html', '/site')).toBe('../');
    expect(rootPrefix('/site/a/b/c.html', '/site')).toBe('../../');
  });
});

describe('injectPage', () => {
  const out = injectPage(PAGE, '../', { fragment: FRAGMENT, head: HEAD });

  it('adds stylesheets and deferred scripts to <head>, in order', () => {
    expect(out).toContain(
      '<link rel="stylesheet" href="../navbar/document.css"/>' +
        '<script defer src="../assets/adapter.js"></script>' +
        '<script defer src="../navbar/navbar.js"></script></head>',
    );
  });

  it('inserts the fragment right after <body>, placeholders replaced', () => {
    expect(out).toContain(
      '<body><sw-docs-navbar><template shadowrootmode="open">\n' +
        '<img src="../navbar/img/logo.svg">',
    );
    expect(out).not.toMatch(/%NAVBAR%|<!--/);
  });

  it('leaves the rest of the page as it was', () => {
    expect(out).toContain('<main>$& page</main>');
  });

  it('leaves a page that already has the navbar alone', () => {
    expect(injectPage(out, '../', { fragment: FRAGMENT, head: HEAD })).toBe(out);
  });

  it('keeps <body> attributes', () => {
    const page = PAGE.replace('<body>', '<body class="x">');
    expect(injectPage(page, './', { fragment: FRAGMENT, head: HEAD })).toContain(
      '<body class="x"><sw-docs-navbar>',
    );
  });

  it('throws on a page without exactly one <body> and </head>', () => {
    const opts = { fragment: FRAGMENT, head: HEAD };
    expect(() => injectPage('<html><body></body></html>', './', opts)).toThrow(/one <body>/);
    expect(() => injectPage(PAGE.replace('<body>', '<body><body>'), './', opts)).toThrow();
  });
});

describe('injectSite', () => {
  it('copies the navbar and adapter and injects every page', () => {
    const site = mkdtempSync(join(tmpdir(), 'inject-navbar-'));
    try {
      mkdirSync(join(site, 'assets'));
      mkdirSync(join(site, 'classes'));
      writeFileSync(join(site, 'index.html'), PAGE);
      writeFileSync(join(site, 'classes/A.html'), PAGE);
      const adapter = join(site, 'adapter.js');
      writeFileSync(adapter, '// adapter');

      expect(injectSite(site, NAVBAR_DIR, [adapter])).toBe(2);
      expect(readdirSync(join(site, 'navbar'))).toContain('navbar.js');
      expect(readdirSync(join(site, 'navbar'))).not.toContain('navbar.html');
      expect(readdirSync(join(site, 'assets'))).toContain('adapter.js');
      const page = readFileSync(join(site, 'classes/A.html'), 'utf-8');
      expect(page).toContain('src="../navbar/img/logo-no-text.svg"');
      expect(page).toContain('<script defer src="../assets/adapter.js"></script>');
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });
});

describe('reference/navbar', () => {
  it('has no TypeDoc references', () => {
    const files = readdirSync(NAVBAR_DIR, { recursive: true, encoding: 'utf-8' }).filter((f) =>
      /\.(html|css|js|md)$/.test(f),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(join(NAVBAR_DIR, file), 'utf-8'), file).not.toMatch(/typedoc|tsd-/i);
    }
  });
});
