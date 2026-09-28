/**
 * Where the package is, and the facts its package.json holds.
 *
 * The docs ship at the package root, beside `dist/`, in the layout they have
 * in the repository, so relative links between them keep working. The same
 * lookup serves a clone of the repository (this file is then
 * `src/cli/tsdocs/locate.ts`) and an installed package
 * (`node_modules/@signalwire/sdk/dist/cli/tsdocs/locate.js`).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The package's name on npm. */
export const PACKAGE_NAME = '@signalwire/sdk';

/** The fields of package.json that sw-tsdocs reads. */
export interface PackageJson {
  /** The package's name. */
  name: string;
  /** The installed version. */
  version: string;
  /** The commands the package installs, by name. */
  bin?: Record<string, string>;
  /** What `npm pack` ships. */
  files?: string[];
}

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The package root: the nearest directory above `from` whose package.json
 * names this package.
 *
 * @param from - Where to start looking; this module's directory by default.
 * @returns The root, or null if no such directory exists.
 */
export function findPackageRoot(from: string = HERE): string | null {
  let dir = from;
  for (;;) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const pkg = JSON.parse(readFileSync(manifest, 'utf-8')) as Partial<PackageJson>;
        if (pkg.name === PACKAGE_NAME) return dir;
      } catch {
        // Not a readable package.json: keep looking further up
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The package root, or an error saying the package can't be found.
 *
 * @returns The package root.
 */
export function packageRoot(): string {
  const root = findPackageRoot();
  if (root === null) {
    throw new Error(`Can't find the ${PACKAGE_NAME} package above ${HERE}.`);
  }
  return root;
}

/**
 * The package's package.json.
 *
 * @param root - The package root.
 * @returns Its parsed contents.
 */
export function readPackageJson(root: string): PackageJson {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as PackageJson;
}

/**
 * The directory holding the code sw-tsdocs runs from: `dist` in an installed
 * package or a build, `src` when run from a clone with tsx.
 *
 * @param root - The package root.
 * @returns The code directory's absolute path.
 */
export function codeDir(root: string): string {
  const top = relative(root, HERE).split(sep)[0];
  return join(root, top === 'src' ? 'src' : 'dist');
}
