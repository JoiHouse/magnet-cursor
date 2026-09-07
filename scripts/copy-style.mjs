// Ship a copy of the core stylesheet inside each framework package so consumers
// can `import '@joihouse/magnet-cursor-vue/style.css'` without depending on the
// core package directly.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../packages/core/public/style.css')
const destination = resolve(process.cwd(), 'dist/style.css')

mkdirSync(dirname(destination), { recursive: true })
copyFileSync(source, destination)
console.log(`copied style.css -> ${destination}`)
