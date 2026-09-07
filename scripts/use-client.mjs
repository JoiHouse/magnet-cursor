// Puts `'use client'` at the top of every JavaScript file tsup emitted.
//
// Everything the React package exports is a hook, or a component built on
// one, so the whole package is a client boundary and Next.js App Router needs
// to be told so in the file itself. tsup cannot do it: a directive in the
// source does not survive esbuild, and `banner` is applied before the
// `treeshake` pass, where rollup drops module-level directives as dead
// statements. So it is added here, after the build, to the ESM chunks and the
// CJS bundle alike.
//
// The line it adds shifts every mapping down by one, so each sourcemap gets an
// empty leading line to match.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DIRECTIVE = "'use client';\n"
const dist = resolve(process.cwd(), 'dist')

for (const name of readdirSync(dist)) {
  if (!/\.(js|cjs)$/.test(name)) continue
  const path = resolve(dist, name)
  const code = readFileSync(path, 'utf8')
  if (code.startsWith(DIRECTIVE)) continue
  writeFileSync(path, DIRECTIVE + code)

  const mapPath = `${path}.map`
  if (!existsSync(mapPath)) continue
  const map = JSON.parse(readFileSync(mapPath, 'utf8'))
  map.mappings = `;${map.mappings}`
  writeFileSync(mapPath, JSON.stringify(map))
}
