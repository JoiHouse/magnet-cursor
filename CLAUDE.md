# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A pnpm workspace publishing three npm packages under `@joihouse/magnet-cursor-*`: `core` (the
framework-agnostic engine, zero dependencies), `react` and `vue` (thin lifecycle wrappers around
core). All three are version-locked via changesets (`fixed` group), so bumping one bumps all.

## Commands

```bash
pnpm install
pnpm build                 # all packages; clean-dist → tsup → post-steps
pnpm dev                   # tsup --watch for all packages in parallel
pnpm test                  # vitest run (jsdom), all packages
pnpm test:watch
pnpm typecheck             # tsc --noEmit per package
pnpm lint                  # eslint + prettier --check
pnpm lint:fix
pnpm check:exports         # publint + are-the-types-wrong + require/import smoke on packed dist
pnpm changeset             # required for every user-facing change
```

Single test file / single test:

```bash
pnpm vitest run packages/core/test/magnet.test.ts
pnpm vitest run packages/core/test/magnet.test.ts -t "layout read before any write"
```

Per-package build/typecheck: `pnpm --filter @joihouse/magnet-cursor-core build`. `test` is root-only;
filter by file path instead.

**Build core before running react/vue tests or typecheck.** The framework packages resolve
`@joihouse/magnet-cursor-core` through the workspace link to `packages/core/dist`; there is no
vitest/tsconfig alias to `src`. CI runs lint → build → typecheck → test → check:exports in that
order for this reason. `check:exports` also needs a fresh build.

## Architecture

### Core: three independent effects sharing one frame

`packages/core/src` exposes three factories, each importable on its own via a subpath
(`/cursor`, `/magnet`, `/gravitational-liquid`) and all re-exported from the root:

- `createMagnetCursor` (`cursor.ts`) — one page-wide custom cursor appended to `document.body`.
  Composes the sub-modules `morph.ts` (cursor merges into hovered elements), `underline.ts`
  (cursor becomes an underline), and `theme.ts` (light/dark palette watcher). Options are split
  into geometry/behaviour (shared) and `MagnetCursorThemeOptions` (paint only, may differ per theme).
- `createMagnet` (`magnet.ts`) — an element leans toward the pointer. Listeners bind to the
  `trigger`, the transform is written to a separate `target`, so the hit area never moves.
- `createGravitationalLiquid` (`gravitational-liquid.ts`) — a blob eroded into an element's
  background. Uses `liquid-surface.ts` (the SVG goo-filter painting) and `spring.ts` (a real
  damped oscillator, not a low-pass, so the follow can overshoot).

Cross-cutting modules:

- `frame.ts` — a single shared `requestAnimationFrame` batch. Every effect registers a
  `FrameTick { measure, commit }`; all `measure`s run before any `commit` so one effect's write
  never invalidates another's read. Frame loops stop when nothing is moving (`threshold`).
- `env.ts` — `isBrowser`, `isPointerDevice`, `prefersReducedMotion`, `lerp`, `clamp`. Every
  effect returns a disabled no-op instance on touch-only devices and under reduced motion
  (`detectPointer` / `respectReducedMotion` options, both default `true`).
- `geometry.ts` — reads painted geometry, correcting for ancestor transforms and box model.
- `public/style.css` — the only stylesheet; copied into each framework package's `dist` at build.

### SSR contract

"Importing on the server does nothing and throws nothing." No browser global (`window`,
`document`, `navigator`) may be touched at module scope; keep them inside functions behind
`isBrowser()`. `eslint.config.js` enforces this with a `no-restricted-syntax` tripwire (tests,
`scripts/` and root `*.mjs` are exempt). Module-level state in `cursor.ts` / `magnet.ts` /
`frame.ts` is fine because it is data, not DOM access.

### Framework packages stay thin

`packages/react` and `packages/vue` only create the core instance, forward options, and destroy
on unmount. Behaviour changes belong in core so both frameworks get them. Each exposes a
component, a hook/composable, and re-exports core; Vue adds `v-magnet` / `v-gravitational-liquid`
directives and `MagnetCursorPlugin`. Shared wrapper helpers: React `internal.ts`
(`useLatest`, `useOptionsSignature` — options are pushed via `setOptions` only when a
non-function option actually changes; callbacks go through stable proxies), Vue `element.ts`
(`resolveElement`, which must tolerate running during server `setup()`).

### Build and packaging

- tsup per package, two configs run in parallel: ESM with code splitting (one entry per feature,
  shared chunk keeps module state single-instance) and CJS as one bundle from the root entry only.
  Subpaths are **ESM-only** in `exports`; `require()` always goes through the root. Core also
  emits an IIFE `magnet-cursor.global.js` (`MagnetCursor` global) for `<script src>`.
- `scripts/clean-dist.mjs` runs first because the two parallel tsup configs racing on `clean`
  dropped `.d.cts` files. `scripts/use-client.mjs` prepends `'use client'` to every React output
  file after the build (tsup/esbuild strips the directive). `scripts/copy-style.mjs` copies
  `core/public/style.css` into react/vue dist. `scripts/require-smoke.mjs` loads the packed
  package via both `require` and `import` in a child process — the check publint/attw don't do.

### Tests

Vitest in jsdom, `packages/*/test/**/*.test.ts`, globals on. Core tests stub
`requestAnimationFrame` to fire synchronously and pass
`{ detectPointer: false, respectReducedMotion: false }` so the guards don't short-circuit
(see `packages/core/test/magnet.test.ts` for the pattern, including `traceLayout` for asserting
read/write phasing). jsdom has no layout, so tests stub `getBoundingClientRect`. New core
behaviour needs a test in `packages/core/test/`.

## Conventions

- **`docs/` is three things, all in Chinese.** `docs/roadmap.md` says what is built when
  (milestones, dependencies, acceptance). `docs/guides/Mn-*-guide.md` is one guide per milestone:
  steps, pitfalls, progress, following the `Pn` / `Pn.x` structure in `docs/guides/README.md`.
  `docs/dev/{core,react,vue}/development.md` is the day-to-day: commands, layout, conventions,
  debugging. Work on a milestone starts by writing or updating its guide. Perf and browser
  claims are measured (Playwright/CDP, real Safari), not inferred from source.
- Comments explain _why_, not what. `cursor.ts` and `magnet.ts` set the bar.
- Prettier is the only formatter; ESLint carries correctness rules only.
- `site/`, `marketing/`, `development/`, `.pg*.mjs`, `.codegraph/` are gitignored local
  directories (the docs site, playground, working notes, one-off browser scripts). They are not
  part of any package and are excluded from lint.
- Releases run from CI: pushes to `main` open a "Version Packages" PR via changesets; merging it
  publishes. Changelog generation needs `GITHUB_TOKEN`.
- Security reports go through GitHub private advisories, not issues.
