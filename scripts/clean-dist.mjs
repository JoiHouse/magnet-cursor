// Empties the package's `dist` before tsup runs.
//
// The build is two tsup configs (ESM with splitting, CJS as one bundle) that
// run in parallel. Letting one of them own `clean: true` is a race: it wipes
// `dist` while the other may already have written its `.d.cts`, and roughly one
// build in four shipped without CJS types. Cleaning once, up front, has no such
// window.
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

rmSync(resolve(process.cwd(), 'dist'), { recursive: true, force: true })
