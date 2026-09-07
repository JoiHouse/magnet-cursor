# Contributing

Thanks for taking the time. This is a pnpm workspace with three published packages. Participation is
governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).

**Found a security problem?** Do not open an issue or a pull request for it — report it privately
through the [Security tab](https://github.com/JoiHouse/magnet-cursor/security/advisories/new).
[SECURITY.md](./SECURITY.md) explains what happens next.

## Setup

```bash
pnpm install
pnpm build
```

Node `>=22` and pnpm `11.x` are required to work on the repository (`packageManager` pins the exact
version; `corepack enable` picks it up). The published packages themselves still support Node
`>=18.18` for server-side rendering.

## Layout

```
packages/core    @joihouse/magnet-cursor-core    the engine — all behaviour lives here
packages/vue     @joihouse/magnet-cursor-vue     Vue lifecycle wrappers only
packages/react   @joihouse/magnet-cursor-react   React lifecycle wrappers only
docs             design notes and the reasoning behind the current APIs
```

**Behaviour changes belong in `packages/core`.** The framework packages should stay thin: create the
instance, forward options, destroy on unmount. If you find yourself writing effect logic in the Vue
or React package, it probably belongs in the core so the other framework gets it too.

## Working on it

```bash
pnpm dev          # watch-build all three packages
pnpm test:watch   # in a second terminal
```

`pnpm dev` rebuilds `packages/*` on change, so a linked app picks the change up without a manual
build. [`docs/roadmap.md`](./docs/roadmap.md) says what is being built and when, one guide per
milestone under [`docs/guides/`](./docs/guides/) says how, and the per-package docs under
[`docs/dev/`](./docs/dev/) cover the day-to-day: commands, layout, conventions, debugging.

## Before opening a PR

```bash
pnpm test
pnpm typecheck
pnpm lint           # eslint + prettier --check; `pnpm lint:fix` fixes both
pnpm build
pnpm check:exports  # publint + are-the-types-wrong on the packed `dist`
```

New core behaviour needs a test in `packages/core/test/`. The tests run in jsdom and stub
`requestAnimationFrame` to fire synchronously — see `magnet.test.ts` for the pattern.

Do check manually on a touch device or with device emulation, and with "reduce motion" enabled in
your OS settings. Both paths are supposed to produce _nothing_.

## Changesets

Every user-facing change needs a changeset:

```bash
pnpm changeset
```

Pick the affected packages and a bump type, and write the line as it should appear in the changelog.
The three packages are version-locked, so a bump to one bumps all.

Releases run from CI: every push to `main` lets the release workflow open or update a
"Version Packages" PR, and merging that PR publishes to npm after a maintainer approves the
`npm` deployment environment. The changelog entries link the PR and
credit its author, which means the generator needs a `GITHUB_TOKEN` in the environment — the
workflow provides one. To run the steps by hand:

```bash
GITHUB_TOKEN=… pnpm version-packages   # applies changesets, updates changelogs
pnpm release                           # builds, checks the packed output, publishes
```

## Style

Prettier is the only formatter — run `pnpm format`. ESLint carries only what the compiler does
not check: a small set of correctness rules and an SSR tripwire that rejects any browser global
touched at module scope, since importing a package on the server must do nothing and throw
nothing. It has no opinion on formatting.

Comments should explain _why_, not restate the code. The existing comments in `cursor.ts` and
`magnet.ts` are the bar: they cover the non-obvious decisions (why the listeners sit on the trigger
rather than the target, why the squash preserves area) and nothing else.
