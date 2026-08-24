#!/usr/bin/env bash
#
# package-smoke-dual.sh — the DUAL-MODE package-consumption smoke (TS-2 / r5 B1+G1).
#
# Locks that the published package is loadable by BOTH module systems from the
# PACKED tarball (not the source tree): an ESM consumer via `import` AND a CJS
# consumer via `require`. The CJS leg is the regression guard for B1 — the
# exports map used to declare only an `import` condition, so
# `require('@signalwire/sdk')` hard-failed at load with
# ERR_PACKAGE_PATH_NOT_EXPORTED for every CommonJS codebase. A `default`/`require`
# condition + Node's require(esm) support (>=22.12) fixes it; this gate keeps it
# fixed.
#
# The port-per-PR PACKAGE-SMOKE (porting-sdk) is nightly-tier for ts (it builds
# dist). This dual-mode smoke is the per-PR TS-repo-local complement: it exercises
# the exports contract deterministically against the packed artifact.
#
# Requires: a built dist/ (run `npm run build` or `tsc && postbuild` first). Picks
# up node from PATH. Writes its scratch consumer into a repo-local, gitignored
# .sw-tmp/ (never a machine-wide temp dir).
#
# Exit 0 = both modes loaded + constructed the public RestClient. Non-zero = a
# consumption mode is broken.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH="$REPO/.sw-tmp/package-smoke-dual"
CONSUMER="$SCRATCH/consumer"

fail() { echo "package-smoke-dual: $*" >&2; exit 1; }

# Self-build dist when absent so the gate is self-contained (npm pack's prepack
# also builds, but building here first surfaces a build failure as this gate's
# failure with a clear message rather than a pack error).
if [ ! -f "$REPO/dist/index.js" ]; then
  echo "package-smoke-dual: dist/ missing — building (npm run build)"
  npm --prefix "$REPO" run build >/dev/null 2>&1 || fail "npm run build failed"
fi
[ -f "$REPO/dist/index.js" ] || fail "dist/index.js missing after build"

rm -rf "$SCRATCH"
mkdir -p "$CONSUMER"

# Pack the SUT into the scratch dir and install it into the scratch consumer, so
# the smoke exercises the packaged tarball's exports map — exactly what a user
# gets — not the source tree.
TGZ="$(cd "$SCRATCH" && npm pack "$REPO" 2>/dev/null | tail -1)"
[ -n "$TGZ" ] || fail "npm pack produced no tarball"
printf '%s\n' '{"name":"pkg-smoke-dual-consumer","version":"0.0.0","private":true}' > "$CONSUMER/package.json"
npm install --prefix "$CONSUMER" "$SCRATCH/$TGZ" >/dev/null 2>&1 || fail "npm install of packed tarball failed"

# ESM leg — .mjs so Node treats it as ESM (import).
cat > "$CONSUMER/smoke.mjs" <<'EOF'
import { RestClient } from '@signalwire/sdk';
const c = new RestClient({ project: 'p', token: 't', host: 'example.signalwire.com' });
if (!c) throw new Error('ESM: RestClient construct returned falsy');
console.log('smoke-ok-esm: import { RestClient } from @signalwire/sdk');
EOF

# CJS leg — .cjs so Node treats it as CommonJS (require). This is the B1 guard.
cat > "$CONSUMER/smoke.cjs" <<'EOF'
const { RestClient } = require('@signalwire/sdk');
const c = new RestClient({ project: 'p', token: 't', host: 'example.signalwire.com' });
if (!c) throw new Error('CJS: RestClient construct returned falsy');
console.log('smoke-ok-cjs: require(@signalwire/sdk)');
EOF

echo "== ESM leg =="
node "$CONSUMER/smoke.mjs" || fail "ESM consumer could not load/construct the package"
echo "== CJS leg =="
node "$CONSUMER/smoke.cjs" || fail "CJS consumer could not require() the package (B1 regression)"

# Clean up the scratch consumer (leave nothing behind).
rm -rf "$SCRATCH"
echo "package-smoke-dual: PASS (ESM + CJS both load the public surface)"
