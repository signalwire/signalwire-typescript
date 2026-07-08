// ESLint flat config for signalwire-typescript — the LINT-depth gate beyond the
// `tsc --noEmit` type floor. Stood up after a one-time no-explicit-any burndown
// to zero (src + tests): every `any` was replaced with a real type, `unknown`
// + narrowing, or a generic — TS's idiomatic answer, NOT mirroring Python's
// Dict[str,Any]. no-explicit-any is therefore ENABLED as an error so the typing
// can't regress. Mirrors the Rust clippy / Go golangci gates: enforced floor,
// short documented exception list, never autofix-and-hope.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Only build output + plain JS are ignored. ALL generated TypeScript —
    // the REST *.types.generated.ts, PlatformContracts.generated.ts, AND the
    // SWML verb-method augmentation (SwmlVerbMethods.generated.ts) — is linted
    // as real source: generated code gets no magic pass; it passes this gate
    // with 0 disables and 0 `any`, same as hand-written code.
    ignores: ['dist/**', 'node_modules/**', '**/*.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Flag any eslint-disable directive that no longer suppresses anything, so
    // stale/needless disables can't accumulate and quietly mask future findings.
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // The burndown made this enforceable. Open/dynamic values use `unknown`
      // (+ narrowing) or generics, never `any`.
      '@typescript-eslint/no-explicit-any': 'error',
      // Honor the leading-underscore convention for intentionally-unused
      // bindings (interface-conformance params like `_bodyParams`, `_headers`,
      // destructured-rest discards). The standard TS idiom for "required by the
      // signature, deliberately unused" — flagging it would noise up correct code.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
);
