/**
 * AuthHandler - Multi-method authentication handler.
 *
 * Supports Bearer token, API key, and Basic auth with constant-time comparison.
 * Can be used as Hono middleware or standalone validator.
 */

import { timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import { getLogger } from './Logger.js';

/** Minimal Express/Connect-style request shape consumed by {@link AuthHandler.expressMiddleware}. */
interface ExpressLikeRequest {
  headers: Record<string, string>;
}

/** Minimal Express/Connect-style response shape consumed by {@link AuthHandler.expressMiddleware}. */
interface ExpressLikeResponse {
  status(code: number): { json(body: unknown): void };
}

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
  customValidator?: (request: {
    headers: Record<string, string>;
    method: string;
    url: string;
  }) => boolean | Promise<boolean>;
  /** When explicitly set to false, deny requests if no auth methods are configured. */
  allowUnauthenticated?: boolean;
}

/**
 * The username/password pair parsed out of an HTTP `Authorization: Basic` header.
 *
 * This is the credential carrier {@link AuthHandler.verifyBasicAuth} verifies. The
 * Python reference receives the same two fields from FastAPI's `HTTPBasicCredentials`;
 * FastAPI is not the contract — the two parsed fields are, and this class carries them
 * with no web framework attached.
 */
export class BasicCredentials {
  /** The username decoded from the Basic credentials. */
  readonly username: string;
  /** The password decoded from the Basic credentials. */
  readonly password: string;

  /**
   * @param username - The username decoded from the Basic credentials.
   * @param password - The password decoded from the Basic credentials.
   */
  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }
}

/**
 * The scheme/credentials pair parsed out of an HTTP `Authorization` header.
 *
 * This is the credential carrier {@link AuthHandler.verifyBearerToken} verifies.
 * `scheme` is the auth scheme as sent (`Bearer`); `credentials` is the raw token that
 * follows it. The Python reference receives the same two fields from FastAPI's
 * `HTTPAuthorizationCredentials`.
 */
export class BearerCredentials {
  /** The authorization scheme as sent on the wire (e.g. `Bearer`). */
  readonly scheme: string;
  /** The raw credential following the scheme — for Bearer, the token itself. */
  readonly credentials: string;

  /**
   * @param scheme - The authorization scheme as sent on the wire (e.g. `Bearer`).
   * @param credentials - The raw credential following the scheme.
   */
  constructor(scheme: string, credentials: string) {
    this.scheme = scheme;
    this.credentials = credentials;
  }
}

/**
 * Split an `Authorization` header into its scheme and credential, mirroring
 * FastAPI's `get_authorization_scheme_param` (the reference partitions on the
 * FIRST space and strips the credential).
 *
 * Returns `null` when the header is absent/empty or the scheme token does not
 * case-insensitively equal `expectedScheme`. RFC 7235 makes the auth-scheme
 * token case-insensitive, so `bearer x` and `Bearer x` are both legal — the
 * reference compares `scheme.lower() != "bearer"` and accepts either.
 */
function schemeParam(authHeader: string | undefined, expectedScheme: string): string | null {
  if (!authHeader) return null;
  const sep = authHeader.indexOf(' ');
  if (sep < 0) return null;
  if (authHeader.slice(0, sep).toLowerCase() !== expectedScheme.toLowerCase()) return null;
  return authHeader.slice(sep + 1).trim();
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
      const token = schemeParam(authHeader, 'Bearer');
      if (token !== null) {
        // The scheme is carried through exactly as the client sent it (the
        // reference reports the wire scheme, not a canonicalized one).
        const sentScheme = authHeader.slice(0, authHeader.indexOf(' '));
        if (this.verifyBearerToken(new BearerCredentials(sentScheme, token))) {
          return true;
        }
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
      const param = schemeParam(authHeader, 'Basic');
      if (param !== null) {
        const decoded = Buffer.from(param, 'base64').toString();
        const colonIdx = decoded.indexOf(':');
        if (colonIdx > 0) {
          const parsed = new BasicCredentials(
            decoded.slice(0, colonIdx),
            decoded.slice(colonIdx + 1),
          );
          if (this.verifyBasicAuth(parsed)) return true;
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
    if (
      !this.config.bearerToken &&
      !this.config.apiKey &&
      !this.config.basicAuth &&
      !this.config.customValidator
    ) {
      if (this.config.allowUnauthenticated === false) {
        return false;
      }
      log.warn(
        'No auth methods configured; allowing unauthenticated access. Set allowUnauthenticated to false to deny.',
      );
      return true;
    }

    return false;
  }

  /**
   * Verify a parsed Basic Auth credential pair against the configured credentials.
   *
   * Returns false immediately if Basic Auth is not configured.
   * Uses constant-time comparison to prevent timing attacks.
   *
   * @param credentials - The username/password pair parsed from the Authorization header.
   * @returns True if the credentials match the configured Basic Auth credentials.
   */
  verifyBasicAuth(credentials: BasicCredentials): boolean {
    if (!this.config.basicAuth) return false;
    const [expectedUser, expectedPass] = this.config.basicAuth;
    return (
      safeCompare(credentials.username, expectedUser) &&
      safeCompare(credentials.password, expectedPass)
    );
  }

  /**
   * Verify a parsed Bearer credential against the configured token.
   *
   * Returns false immediately if Bearer token auth is not configured.
   * Uses constant-time comparison to prevent timing attacks.
   *
   * Only the `credentials` field (the raw token) is compared — the same field the
   * Python reference compares. The `scheme` is carried for fidelity with what the
   * Authorization header actually said, and is not part of the secret comparison.
   *
   * @param credentials - The scheme/token pair parsed from the Authorization header.
   * @returns True if the token matches the configured Bearer token.
   */
  verifyBearerToken(credentials: BearerCredentials): boolean {
    if (!this.config.bearerToken) return false;
    return safeCompare(credentials.credentials, this.config.bearerToken);
  }

  /**
   * Verify an API key against the configured key.
   *
   * Returns false immediately if API key auth is not configured.
   * Uses constant-time comparison to prevent timing attacks.
   *
   * @param key - The API key string to verify.
   * @returns True if the key matches the configured API key.
   */
  verifyApiKey(key: string): boolean {
    if (!this.config.apiKey) return false;
    return safeCompare(key, this.config.apiKey);
  }

  /**
   * Create a Hono-compatible middleware that rejects unauthorized requests with a 401 response.
   * @param optional - When true, unauthenticated requests are allowed through instead of being rejected (default: false).
   * @returns A middleware function suitable for use with Hono's `app.use()`.
   */
  middleware(
    optional = false,
  ): (c: Context, next: () => Promise<void>) => Promise<Response | void> {
    return async (c: Context, next: () => Promise<void>) => {
      const headers: Record<string, string> = {};
      c.req.raw.headers.forEach((v: string, k: string) => {
        headers[k] = v;
      });

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
  expressMiddleware(
    optional = false,
  ): (req: ExpressLikeRequest, res: ExpressLikeResponse, next: () => void) => Promise<void> {
    return async (req: ExpressLikeRequest, res: ExpressLikeResponse, next: () => void) => {
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
