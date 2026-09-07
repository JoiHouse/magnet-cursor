import { defineConfig } from 'tsup'

const shared = {
  dts: true,
  clean: false,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
} as const

export default defineConfig([
  {
    ...shared,
    // One ESM entry per feature, so `…/cursor` and `…/magnet` can be imported
    // on their own. Splitting pulls the shared env helpers into a chunk both
    // entries reference, which is also what keeps the module level state in
    // `magnet.ts` and `cursor.ts` a single instance however you import them.
    entry: ['src/index.ts', 'src/cursor.ts', 'src/magnet.ts', 'src/gravitational-liquid.ts'],
    format: ['esm'],
    splitting: true,
    publicDir: 'public',
  },
  {
    ...shared,
    // No sourcemap for CJS. It was the single largest thing in the published
    // package — `index.cjs.map` alone outweighed every shipped `.js` put
    // together — and CJS here is only the compatibility entry: modern bundlers
    // take the ESM path, which keeps its map. Nobody steps through this build.
    // esbuild cannot split CJS, so CJS stays a single bundle reached through
    // the root entry only. Subpaths are declared ESM-only in `exports`.
    entry: ['src/index.ts'],
    format: ['cjs'],
    sourcemap: false,
  },
  {
    ...shared,
    /*
     * The build for a plain `<script src>`, with no bundler anywhere.
     *
     * Everything else here ships bare module specifiers, which only a bundler
     * can resolve — so a page that just wants a cursor had no way in. One file,
     * one global, no import map. The stylesheet stays a separate `<link>`:
     * inlining it would win a line and cost the reader the ability to override
     * the custom properties it defines.
     */
    entry: { 'magnet-cursor': 'src/index.ts' },
    format: ['iife'],
    globalName: 'MagnetCursor',
    minify: true,
    sourcemap: false,
    dts: false,
  },
])
