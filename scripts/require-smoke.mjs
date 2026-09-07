// Loads the built package the way a consumer would, once through `require`
// and once through `import`, and fails if either throws.
//
// `publint` and `attw` check that this package's own entries resolve; neither
// follows what those entries go on to load. The CJS bundle once required a
// core subpath that is exported for `import` only, so every Node16 and Jest
// consumer failed at load time while both tools stayed green. This is the
// check they do not do.
//
// Each load runs in a child process started in the package directory: Node
// resolves a package's own name through its `exports` only from inside it.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { name } = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
const check = `(m) => { if (Object.keys(m).length === 0) throw new Error('${name}: loaded nothing') }`

for (const [label, args] of [
  ['require', ['-e', `(${check})(require('${name}'))`]],
  ['import', ['--input-type=module', '-e', `import * as m from '${name}'; (${check})(m)`]],
]) {
  try {
    execFileSync(process.execPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  } catch (error) {
    throw new Error(`${name}: ${label} failed\n${error.stderr}`, { cause: error })
  }
}
