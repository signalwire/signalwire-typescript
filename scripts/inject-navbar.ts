/**
 * inject-navbar.ts — add the SignalWire docs navbar to the generated API reference.
 *
 * `npm run docs:reference` runs TypeDoc into `reference/_site`, then this
 * script. It copies `reference/navbar/` to `<site>/navbar/` and the TypeDoc
 * adapter (`reference/typedoc-navbar.{css,js}`) to `<site>/assets/`, then
 * edits every page in the site:
 *
 *   - `<head>` gets `navbar/document.css`, the adapter, and `navbar/navbar.js`,
 *     adapter before navbar so the navbar finds the adapter when it starts;
 *   - the navbar markup (`navbar/navbar.html`) goes right after `<body>`.
 *
 * Every path written into a page is relative to that page, so the site works
 * under any base URL. A page that already has the navbar is left alone, so
 * running twice is safe. Exits 1 if a page lacks exactly one `<body>` and one
 * `</head>`, so a page without the navbar fails the build.
 *
 * `reference/navbar/` knows nothing about TypeDoc; everything TypeDoc-specific
 * is the adapter and this script. See `reference/navbar/README.md`.
 *
 * Usage:
 *
 *   npx tsx scripts/inject-navbar.ts                 # reference/_site
 *   npx tsx scripts/inject-navbar.ts <site-dir>
 *
 * `injectPage()` does the per-page edit without touching the filesystem; the
 * tests use it.
 */

import { copyFileSync, cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where the navbar directory is copied, relative to the site root. */
const NAVBAR_DIR = 'navbar/';

/** Where the adapter files are copied, relative to the site root. */
const ADAPTER_DIR = 'assets/';

/** The navbar's element name; a page containing it already has the navbar. */
const MARKER = '<sw-docs-navbar';

export interface InjectOptions {
  /** `navbar/navbar.html`, with `%NAVBAR%` unreplaced. */
  fragment: string;
  /** Stylesheets and scripts to add to `<head>`, in order, relative to the site root. */
  head: string[];
}

/**
 * The relative path from the page at `pagePath` to `siteDir`, ending in `/`:
 * `./` for a page at the root, `../` one level down.
 */
export function rootPrefix(pagePath: string, siteDir: string): string {
  const rel = relative(dirname(pagePath), siteDir).split(sep).join('/');
  return rel === '' ? './' : `${rel}/`;
}

/**
 * Add the navbar to one page. `root` is the page's path to the site root,
 * from {@link rootPrefix}. Returns the page unchanged if it already has the
 * navbar; throws if it lacks exactly one `<body>` and one `</head>`.
 */
export function injectPage(html: string, root: string, opts: InjectOptions): string {
  if (html.includes(MARKER)) return html;
  const bodies = html.match(/<body\b[^>]*>/g) ?? [];
  const headEnds = html.match(/<\/head>/g) ?? [];
  if (bodies.length !== 1 || headEnds.length !== 1) {
    throw new Error(
      `expected one <body> and one </head>, found ${bodies.length} and ${headEnds.length}`,
    );
  }
  const tags = opts.head
    .map((file) =>
      file.endsWith('.css')
        ? `<link rel="stylesheet" href="${root}${file}"/>`
        : `<script defer src="${root}${file}"></script>`,
    )
    .join('');
  const navbar = opts.fragment
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .replaceAll('%NAVBAR%', `${root}${NAVBAR_DIR}`)
    .trim();
  return html
    .replace('</head>', () => `${tags}</head>`)
    .replace(bodies[0], (body) => `${body}${navbar}`);
}

/** Copy the navbar and adapter into `siteDir` and add the navbar to every page. */
export function injectSite(siteDir: string, navbarDir: string, adapterFiles: string[]): number {
  const fragment = readFileSync(join(navbarDir, 'navbar.html'), 'utf-8');
  cpSync(navbarDir, join(siteDir, NAVBAR_DIR), {
    recursive: true,
    // The markup goes into each page; the README is for the source tree.
    filter: (src) => !['navbar.html', 'README.md'].includes(basename(src)),
  });
  for (const file of adapterFiles) copyFileSync(file, join(siteDir, ADAPTER_DIR, basename(file)));

  const adapter = adapterFiles.map((file) => `${ADAPTER_DIR}${basename(file)}`);
  const head = [
    `${NAVBAR_DIR}document.css`,
    ...adapter.filter((file) => file.endsWith('.css')),
    ...adapter.filter((file) => file.endsWith('.js')),
    `${NAVBAR_DIR}navbar.js`,
  ];

  const pages = readdirSync(siteDir, { recursive: true, encoding: 'utf-8' })
    .filter((file) => file.endsWith('.html'))
    .map((file) => join(siteDir, file));
  for (const page of pages) {
    const html = readFileSync(page, 'utf-8');
    let out: string;
    try {
      out = injectPage(html, rootPrefix(page, siteDir), { fragment, head });
    } catch (err) {
      throw new Error(`${relative(siteDir, page)}: ${(err as Error).message}`);
    }
    if (out !== html) writeFileSync(page, out);
  }
  return pages.length;
}

function main(): number {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const siteDir = resolve(process.argv[2] ?? join(root, 'reference/_site'));
  try {
    const count = injectSite(siteDir, join(root, 'reference/navbar'), [
      join(root, 'reference/typedoc-navbar.css'),
      join(root, 'reference/typedoc-navbar.js'),
    ]);
    console.log(`inject-navbar: ${count} pages in ${relative(root, siteDir) || '.'}`);
    return 0;
  } catch (err) {
    console.error(`inject-navbar: ${(err as Error).message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
