import { defineConfig } from 'tsup'

const external = ['vue', '@joihouse/magnet-cursor-core']

const shared = {
  dts: true,
  clean: false,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
  external,
} as const

export default defineConfig([
  {
    ...shared,
    // One ESM entry per feature, so `…/cursor` and `…/magnet` can be imported
    // on their own. Splitting keeps the shared internals in a single chunk.
    entry: {
      index: 'src/index.ts',
      cursor: 'src/entry-cursor.ts',
      magnet: 'src/entry-magnet.ts',
      'gravitational-liquid': 'src/entry-gravitational-liquid.ts',
    },
    format: ['esm'],
    splitting: true,
  },
  {
    ...shared,
    // No sourcemap for CJS. It was the single largest thing in the published
    // package — `index.cjs.map` alone outweighed every shipped `.js` put
    // together — and CJS here is only the compatibility entry: modern bundlers
    // take the ESM path, which keeps its map. Nobody steps through this build.
    // esbuild cannot split CJS, so CJS stays a single bundle reached through
    // the root entry only. Subpaths are declared ESM-only in `exports`.
    entry: { index: 'src/index.ts' },
    format: ['cjs'],
    sourcemap: false,
  },
])
