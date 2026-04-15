/**
 * ConfigLoader - JSON config file loader with env var interpolation.
 *
 * Supports ${VAR|default} syntax for env var substitution and
 * dot-notation access for nested values.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ENV_VAR_PATTERN = /\$\{([^}|]+)(?:\|([^}]*))?\}/g;

/** JSON configuration file loader with environment variable interpolation and dot-notation access. */
export class ConfigLoader {
  private static readonly DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  private data: Record<string, unknown> = {};
  private filePath: string | null = null;

  /** The ordered list of config file paths that were searched or provided. */
  private _configPaths: string[] = [];

  /**
   * Create a new ConfigLoader, optionally loading a JSON file immediately.
   *
   * Accepts a single file path or an array of paths. When given an array,
   * the loader iterates in order and loads the first file that exists
   * (mirroring Python's ordered-search behaviour).
   *
   * @param filePaths - Path(s) to a JSON config file to load on construction.
   */
  constructor(filePaths?: string | string[]) {
    if (filePaths) {
      if (Array.isArray(filePaths)) {
        this._configPaths = filePaths;
        for (const fp of filePaths) {
          const absPath = resolve(fp);
          if (existsSync(absPath)) {
            this.load(absPath);
            return;
          }
        }
        // No file found in array — store paths but don't throw
      } else {
        this._configPaths = [filePaths];
        this.load(filePaths);
      }
    }
  }

  /**
   * Get the ordered list of config file paths that were passed/searched.
   * @returns The array of config paths.
   */
  get configPaths(): string[] {
    return [...this._configPaths];
  }

  /**
   * Load configuration from a JSON file, performing `${VAR|default}` env var interpolation on the raw text.
   * @param filePath - Path to the JSON config file.
   * @returns This instance for chaining.
   */
  load(filePath: string): this {
    const absPath = resolve(filePath);
    if (!existsSync(absPath)) {
      throw new Error(`Config file not found: ${absPath}`);
    }
    const raw = readFileSync(absPath, 'utf-8');
    const interpolated = this.interpolateEnvVars(raw);
    this.data = JSON.parse(interpolated);
    this.filePath = absPath;
    return this;
  }

  /**
   * Search for a config file in standard locations.
   *
   * Default search paths: CWD, `./config`, `$HOME/.signalwire`,
   * `.swml/`, `$HOME/.swml/`, `/etc/swml/`.
   *
   * @param filename - The config file name to search for.
   * @param additionalPaths - Extra directories to search before the defaults.
   * @param serviceName - Optional service name; prepends service-specific filenames to the search.
   * @returns A loaded ConfigLoader if found, or null if the file does not exist in any search path.
   */
  static search(filename: string, additionalPaths?: string[], serviceName?: string): ConfigLoader | null {
    const searchPaths = ConfigLoader._buildSearchPaths(filename, additionalPaths, serviceName);

    for (const fp of searchPaths) {
      if (existsSync(fp)) {
        return new ConfigLoader(fp);
      }
    }
    return null;
  }

  /**
   * Find a config file path without loading it.
   *
   * Searches service-specific filenames, additional paths, and default paths.
   * Returns the first found path string or null.
   *
   * @param serviceName - Optional service name for service-specific config filenames.
   * @param additionalPaths - Additional file paths to check.
   * @returns Path to the first config file found, or null.
   */
  static findConfigFile(serviceName?: string, additionalPaths?: string[]): string | null {
    const paths: string[] = [];

    // Service-specific config
    if (serviceName) {
      paths.push(
        `${serviceName}_config.json`,
        join('.swml', `${serviceName}_config.json`),
      );
    }

    // Additional paths
    if (additionalPaths) {
      paths.push(...additionalPaths);
    }

    // Default paths
    paths.push(
      'config.json',
      'agent_config.json',
      join('.swml', 'config.json'),
      join(homedir(), '.swml', 'config.json'),
      join('/etc', 'swml', 'config.json'),
    );

    for (const p of paths) {
      const abs = resolve(p);
      if (existsSync(abs)) {
        return abs;
      }
    }

    return null;
  }

  /**
   * Build the list of file paths to search.
   */
  private static _buildSearchPaths(filename: string, additionalPaths?: string[], serviceName?: string): string[] {
    const paths: string[] = [];

    // Service-specific variants
    if (serviceName) {
      paths.push(join(process.cwd(), `${serviceName}_${filename}`));
      paths.push(join(process.cwd(), '.swml', `${serviceName}_${filename}`));
    }

    // Additional caller-provided directories
    if (additionalPaths) {
      for (const dir of additionalPaths) {
        paths.push(join(dir, filename));
      }
    }

    // Default search directories
    paths.push(
      join(process.cwd(), filename),
      join(process.cwd(), 'config', filename),
      join(homedir(), '.signalwire', filename),
      join(process.cwd(), '.swml', filename),
      join(homedir(), '.swml', filename),
      join('/etc', 'swml', filename),
    );

    return paths;
  }

  /**
   * Retrieve a configuration value using a dot-notation path (e.g. `'server.port'`).
   * @param path - Dot-separated key path into the config object.
   * @param defaultValue - Value returned when the path does not exist.
   * @returns The resolved value, or defaultValue if not found.
   */
  get<T = unknown>(path: string, defaultValue?: T): T {
    const parts = path.split('.');
    if (parts.some(p => ConfigLoader.DANGEROUS_KEYS.has(p))) {
      return defaultValue as T;
    }
    let current: unknown = this.data;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue as T;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return (current !== undefined ? current : defaultValue) as T;
  }

  /**
   * Set a configuration value at the given dot-notation path, creating intermediate objects as needed.
   * @param path - Dot-separated key path into the config object.
   * @param value - The value to store.
   * @returns This instance for chaining.
   */
  set(path: string, value: unknown): this {
    const parts = path.split('.');
    if (parts.some(p => ConfigLoader.DANGEROUS_KEYS.has(p))) {
      return this;
    }
    let current: Record<string, unknown> = this.data;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return this;
  }

  /**
   * Check whether a dot-notation path exists in the loaded configuration.
   * @param path - Dot-separated key path to check.
   * @returns True if the path resolves to a defined value.
   */
  has(path: string): boolean {
    const parts = path.split('.');
    let current: unknown = this.data;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return false;
      }
      if (!(part in (current as Record<string, unknown>))) return false;
      current = (current as Record<string, unknown>)[part];
    }
    return true;
  }

  /**
   * Return a shallow copy of the entire configuration object.
   * @returns A copy of the top-level config data.
   */
  getAll(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Alias for {@link getAll} — matches the Python SDK's `get_config()` method name.
   * @returns A copy of the top-level config data.
   */
  getConfig(): Record<string, unknown> {
    return this.getAll();
  }

  /**
   * Return the absolute path of the loaded config file, if any.
   * @returns The file path, or null if config was loaded from an object.
   */
  getFilePath(): string | null {
    return this.filePath;
  }

  /**
   * Alias for {@link getFilePath} — matches the Python SDK's `get_config_file()` method name.
   * @returns The file path, or null if config was loaded from an object.
   */
  getConfigFile(): string | null {
    return this.getFilePath();
  }

  /**
   * Check if a configuration was loaded.
   *
   * **Deliberate deviation from Python `has_config()`:** Python returns `True`
   * only when a file was loaded (`self._config is not None`). This TypeScript
   * implementation also returns `true` when data was loaded via
   * {@link loadFromObject}, because `loadFromObject` is an extra TS-only method
   * with no Python equivalent. Treating object-loaded data as "configured" is
   * the correct semantic for the TS API surface.
   *
   * If you need file-load-only detection, check `this.getFilePath() !== null`.
   *
   * @returns True if configuration data exists (from file or object).
   */
  hasConfig(): boolean {
    return this.filePath !== null || Object.keys(this.data).length > 0;
  }

  /**
   * Get an entire configuration section with all environment variables substituted.
   * @param section - The top-level section name (e.g. 'security', 'server').
   * @returns The configuration section as an object, or an empty object if not found.
   */
  getSection(section: string): Record<string, unknown> {
    const value = this.get<Record<string, unknown>>(section);
    if (value === undefined || value === null || typeof value !== 'object') {
      return {};
    }
    return this.substituteVars(value) as Record<string, unknown>;
  }

  /**
   * Recursively substitute `${VAR|default}` environment variables in any value.
   *
   * Walks strings, objects, and arrays. Coerces result strings to boolean
   * (`"true"` / `"false"`) or number when appropriate.
   *
   * @param value - The value to process (string, object, array, or primitive).
   * @param maxDepth - Maximum recursion depth to prevent infinite loops (default: 10).
   * @returns The value with all environment variables substituted.
   */
  substituteVars(value: unknown, maxDepth = 10): unknown {
    if (maxDepth <= 0) {
      throw new Error('Maximum variable substitution depth exceeded');
    }

    if (typeof value === 'string') {
      const result = value.replace(ENV_VAR_PATTERN, (_match, varName: string, defaultValue?: string) => {
        const envVal = process.env[varName.trim()];
        if (envVal !== undefined) return envVal;
        if (defaultValue !== undefined) return defaultValue;
        return '';
      });

      // Coerce to boolean
      if (result.toLowerCase() === 'true') return true;
      if (result.toLowerCase() === 'false') return false;
      // Coerce to integer
      if (/^\d+$/.test(result)) return parseInt(result, 10);
      // Coerce to float
      if (/^\d+\.\d+$/.test(result)) return parseFloat(result);

      return result;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.substituteVars(item, maxDepth - 1));
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = this.substituteVars(v, maxDepth - 1);
      }
      return result;
    }

    return value;
  }

  /**
   * Merge configuration with environment variables that match a prefix.
   *
   * Config file values take precedence over environment variables.
   * Environment variable keys are stripped of the prefix and lowercased.
   *
   * **Flat mode (default — `nested` omitted or `false`):**
   * The lowercased key is stored as-is (e.g. `SWML_FOO_BAR` → `{ foo_bar: v }`).
   * Flat keys are unambiguous and predictable. Callers that need nested
   * access can use {@link get} with dot-notation after loading.
   *
   * **Nested mode (`nested: true`):**
   * Replicates Python's `merge_with_env()` behaviour: the lowercased key is
   * split on `_` and the value is written into a nested dict
   * (e.g. `SWML_FOO_BAR` → `{ foo: { bar: v } }`). The check for whether a
   * key is already present in config also walks the same nested path, so
   * config-file values still take precedence. Pass `nested: true` when
   * porting Python callers that rely on this structure.
   *
   * @param envPrefix - Prefix for environment variables to consider (default: `'SWML_'`).
   * @param opts - Options object.
   * @param opts.nested - When `true`, split the stripped key on `_` and write
   *   values into nested objects (Python-compatible mode). Defaults to `false`.
   * @returns Merged configuration dictionary.
   */
  mergeWithEnv(envPrefix?: string, opts?: { nested?: boolean }): Record<string, unknown>;
  mergeWithEnv(envPrefix = 'SWML_', opts: { nested?: boolean } = {}): Record<string, unknown> {
    // Start with substituted config
    const result = (Object.keys(this.data).length > 0
      ? this.substituteVars(this.data)
      : {}) as Record<string, unknown>;

    const useNested = opts.nested === true;

    // Add env vars not already present in config
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(envPrefix) && value !== undefined) {
        const configKey = key.slice(envPrefix.length).toLowerCase();
        if (useNested) {
          if (!this._hasNestedKey(result, configKey)) {
            this._setNestedKey(result, configKey, value);
          }
        } else {
          if (!(configKey in result)) {
            result[configKey] = value;
          }
        }
      }
    }

    return result;
  }

  /**
   * Check if a nested key (underscore-separated path) exists in a dict.
   * Used by {@link mergeWithEnv} nested mode to mirror Python's `_has_nested_key`.
   */
  private _hasNestedKey(data: Record<string, unknown>, keyPath: string): boolean {
    const keys = keyPath.split('_');
    let current: unknown = data;
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return false;
      }
      if (!(key in (current as Record<string, unknown>))) {
        return false;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return true;
  }

  /**
   * Set a value in a dict using an underscore-separated path, creating
   * intermediate objects as needed.
   * Used by {@link mergeWithEnv} nested mode to mirror Python's `_set_nested_key`.
   */
  private _setNestedKey(data: Record<string, unknown>, keyPath: string, value: unknown): void {
    const keys = keyPath.split('_');
    let current: Record<string, unknown> = data;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Load configuration from a plain object instead of a file, useful for testing or programmatic setup.
   * @param obj - The configuration object to use.
   * @returns This instance for chaining.
   */
  loadFromObject(obj: Record<string, unknown>): this {
    this.data = { ...obj };
    this.filePath = null;
    return this;
  }

  /**
   * Interpolate ${VAR|default} patterns in a raw string.
   * @param input - The string containing env var references.
   * @returns The string with all env var references resolved.
   */
  interpolateEnvVars(input: string): string {
    return input.replace(ENV_VAR_PATTERN, (_match, varName: string, defaultValue?: string) => {
      const envVal = process.env[varName.trim()];
      if (envVal !== undefined) return envVal;
      if (defaultValue !== undefined) return defaultValue;
      return '';
    });
  }
}
