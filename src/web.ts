/**
 * Cross-port host-app router type.
 *
 * `HostAppRouter` is the named return type of `asRouter()` — the "embed this
 * agent/service's routes into your own host web app" capability (used as
 * `hostApp.route(path, agent.asRouter())`).
 *
 * It is a type alias for Hono's app/router type — so at runtime it IS a `Hono`
 * instance and every existing consumer (`app.route(...)`, `app.fetch`, route
 * introspection) works unchanged; the alias adds no behavior. Its purpose is to
 * give the capability a **stable, named cross-port type** in the signature
 * oracle: every port implements `asRouter()` returning its own framework's mount
 * handle (Python a FastAPI `APIRouter`, Go an `http.Handler`, .NET an
 * `IEndpointRouteBuilder`, Ruby a Rack app, Perl a PSGI coderef, Java an
 * `HttpHandler`, Rust an `axum::Router`, TS a Hono sub-app, C++ an httplib
 * handler), and each port maps that native type to the canonical
 * `signalwire.core.web.HostAppRouter` in its type-alias table. The capability is
 * thereby enforced cross-port; the framework-specific realization is idiom.
 */

import type { Hono } from 'hono';

/**
 * A Hono app/router returned by `asRouter()`.
 *
 * Behaviourally identical to `Hono` (no added state or methods) — it exists to
 * name the "embed my routes in a host app" return type as a stable cross-port
 * symbol. See the module docstring.
 */
export type HostAppRouter = Hono;
