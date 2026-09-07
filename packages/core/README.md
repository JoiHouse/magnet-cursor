# @joihouse/magnet-cursor-core

Framework-agnostic engine behind [magnet-cursor](https://github.com/JoiHouse/magnet-cursor): a
trailing custom cursor and magnetic hover effects. Zero dependencies, SSR safe, ESM + CJS + types.

```bash
pnpm add @joihouse/magnet-cursor-core
```

```ts
import { createMagnet, createMagnetCursor } from '@joihouse/magnet-cursor-core'
import '@joihouse/magnet-cursor-core/style.css'

const cursor = createMagnetCursor({ lerp: 0.2, color: '#000' })
const magnet = createMagnet(document.querySelector('button')!, { strength: 0.35, target: 'svg' })

// always clean up
cursor.destroy()
magnet.destroy()
```

Both functions return an inert instance — same shape, no-op methods — during SSR, on touch-only
devices, and under `prefers-reduced-motion`.

Using Vue or React? Install [`@joihouse/magnet-cursor-vue`](https://www.npmjs.com/package/@joihouse/magnet-cursor-vue)
or [`@joihouse/magnet-cursor-react`](https://www.npmjs.com/package/@joihouse/magnet-cursor-react)
instead — they re-export everything here.

**[Full documentation →](https://github.com/JoiHouse/magnet-cursor)**

MIT © joihouse
