/**
 * AuthHandler - Multi-method authentication handler.
 *
 * Supports Bearer token, API key, and Basic auth with constant-time comparison.
 * Can be used as Hono middleware or standalone validator.
 */

import { timingSafeEqual } from 'node:crypto';
import { getLogger } from './Logger.js';

const log = getLogger('AuthHandler');

/** Configuration for one or more authentication methods checked by {@link AuthHandler}. */
export interface AuthConfig {
  /** Bearer token matched against the Authorization header. */
  bearerToken?: string;
  /** API key matched against the X-Api-Key header. */
  apiKey?: string;
  /** Custom header name for API key lookup (default: 'X-Api-Key'). */
  apiKeyHeader?: string;
  /** Basic auth credentials as a [username, password] tuple. */
  basicAuth?: [string, string];
  /** Custom validator function; return true to allow the request. */
  customValidator?: (request: { headers: Record<string, string>; method: string; url: string }) => boolean | Promise<boolean>;
  /** When explicitly set to false, deny requests if no auth methods are configured. */
  allowUnauthenticated?: boolean;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  const result = timingSafeEqual(
    Buffer.from(a.padEnd(maxLen, '\0')),
    Buffer.from(b.padEnd(maxLen, '\0')),
  );
  return result && a.length === b.length;
}

/** Multi-method authentication handler with timing-safe credential comparison. */
export class AuthHandler {
  /** The authentication configuration for this handler. */
  readonly config: AuthConfig;

  /**
   * Create a new AuthHandler.
   * @param config - Authentication configuration specifying one or more auth methods.
   */
  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Validate request headers against configured auth methods (Bearer, API Key, Basic, Custom) in order.
   * @param headers - The request headers as a string-keyed record.
   * @returns True if any configured method accepts the request, or if no methods are configured.
   */
  async validate(headers: Record<string, string>): Promise<boolean> {
    // 1. Bearer token
    if (this.config.bearerToken) {
      const authHeader = headers['authorization'] || headers['Authorization'] || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (safeCompare(token, this.config.bearerToken)) return true;
      }
    }

    // 2. API Key
    if (this.config.apiKey) {
      const headerName = this.config.apiKeyHeader ?? 'X-Api-Key';
      const headerLower = headerName.toLowerCase();
      const key = headers[headerLower] || headers[headerName] || '';
      if (key && safeCompare(key, this.config.apiKey)) return true;
    }

    // 3. Basic auth
    if (this.config.basicAuth) {
      const authHeader = headers['authorization'] || headers['Authorization'] || '';
      if (authHeader.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
        const colonIdx = decoded.indexOf(':');
        if (colonIdx > 0) {
          const user = decoded.slice(0, colonIdx);
          const pass = decoded.slice(colonIdx + 1);
          const [expectedUser, expectedPass] = this.config.basicAuth;
          if (safeCompare(user, expectedUser) && safeCompare(pass, expectedPass)) return true;
        }
      }
    }

    // 4. Custom validator
    if (this.config.customValidator) {
      const result = await this.config.customValidator({
        headers,
        method: '',
        url: '',
      });
      if (result) return true;
    }

    // If no methods configured, check allowUnauthenticated flag
    if (!this.config.bearerToken && !this.config.apiKey && !this.config.basicAuth && !this.config.customValidator) {
      if (this.config.allowUnauthenticated === false) {
        return false;
      }
      log.warn('No auth methods configured; allowing unauthenticated access. Set allowUnauthenticated to false to deny.');
      return true;
    }

    return false;
  }

  /**
   * Create a Hono-compatible middleware that rejects unauthorized requests with a 401 response.
   * @param optional - When true, unauthenticated requests are allowed through instead of being rejected (default: false).
   * @returns A middleware function suitable for use with Hono's `app.use()`.
   */
  middleware(optional = false): (c: any, next: () => Promise<void>) => Promise<Response | void> {
    return async (c: any, next: () => Promise<void>) => {
      const headers: Record<string, string> = {};
      c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v; });

      const valid = await this.validate(headers);
      if (!valid && !optional) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      await next();
    };
  }

  /**
   * Create an Express/Connect-compatible middleware adapter.
   *
   * This serves as the framework-agnostic equivalent of Python's
   * `get_fastapi_dependency`. For standalone validation without a
   * framework, use {@link validate} directly.
   *
   * @param optional - When true, unauthenticated requests are allowed through (default: false).
   * @returns An Express-compatible middleware function.
   */
  expressMiddleware(optional = false): (req: any, res: any, next: () => void) => Promise<void> {
    return async (req: any, res: any, next: () => void) => {
      const headers = req.headers as Record<string, string>;
      const valid = await this.validate(headers);
      if (!valid && !optional) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    };
  }

  /**
   * Get information about configured authentication methods.
   *
   * Returns structured metadata describing each enabled auth method,
   * including usernames, header names, and usage hints.
   *
   * @returns An object describing the enabled auth methods and their configuration.
   */
  getAuthInfo(): {
    basic?: { enabled: true; username: string };
    bearer?: { enabled: true; hint: string };
    apiKey?: { enabled: true; header: string; hint: string };
  } {
    const info: {
      basic?: { enabled: true; username: string };
      bearer?: { enabled: true; hint: string };
      apiKey?: { enabled: true; header: string; hint: string };
    } = {};

    if (this.config.basicAuth) {
      info.basic = { enabled: true, username: this.config.basicAuth[0] };
    }

    if (this.config.bearerToken) {
      info.bearer = { enabled: true, hint: 'Use Authorization: Bearer <token>' };
    }

    if (this.config.apiKey) {
      const header = this.config.apiKeyHeader ?? 'X-Api-Key';
      info.apiKey = { enabled: true, header, hint: `Use ${header}: <key>` };
    }

    return info;
  }

  /**
   * Check whether Bearer token authentication is configured.
   * @returns True if a bearer token has been set.
   */
  hasBearerAuth(): boolean {
    return !!this.config.bearerToken;
  }

  /**
   * Check whether API key authentication is configured.
   * @returns True if an API key has been set.
   */
  hasApiKeyAuth(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Check whether Basic authentication is configured.
   * @returns True if basic auth credentials have been set.
   */
  hasBasicAuth(): boolean {
    return !!this.config.basicAuth;
  }
}
