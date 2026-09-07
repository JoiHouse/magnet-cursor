# @joihouse/magnet-cursor-vue

Vue 3 bindings for [magnet-cursor](https://github.com/JoiHouse/magnet-cursor): a trailing custom
cursor and magnetic hover effects. SSR safe, works in Nuxt without extra setup.

```bash
pnpm add @joihouse/magnet-cursor-vue
```

```vue
<script setup lang="ts">
import { MagnetCursor, vMagnet } from '@joihouse/magnet-cursor-vue'
import '@joihouse/magnet-cursor-vue/style.css'
</script>

<template>
  <MagnetCursor color="#000" />

  <button v-magnet>Hover me</button>
  <button v-magnet="{ target: 'svg', strength: 0.5 }">
    <svg><!-- only the icon moves --></svg>
  </button>
</template>
```

Or register globally:

```ts
import { MagnetCursorPlugin } from '@joihouse/magnet-cursor-vue'

createApp(App).use(MagnetCursorPlugin)
```

**Exports:** `<MagnetCursor>`, `<Magnet>`, `<GravitationalLiquid>`, `vMagnet`,
`vGravitationalLiquid`, `MagnetCursorPlugin`, `useMagnetCursor()`, `useMagnet()`,
`useGravitationalLiquid()`, plus everything from `@joihouse/magnet-cursor-core`.

Requires Vue `^3.3.0`.

**[Full documentation →](https://github.com/JoiHouse/magnet-cursor)**

MIT © joihouse
