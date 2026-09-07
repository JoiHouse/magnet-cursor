# @joihouse/magnet-cursor-react

React bindings for [magnet-cursor](https://github.com/JoiHouse/magnet-cursor): a trailing custom
cursor and magnetic hover effects. SSR safe, StrictMode safe, works in Next.js.

```bash
pnpm add @joihouse/magnet-cursor-react
```

```tsx
import { Magnet, MagnetCursor, useMagnet } from '@joihouse/magnet-cursor-react'
import '@joihouse/magnet-cursor-react/style.css'

function MagnetButton() {
  const { ref } = useMagnet<HTMLButtonElement>({ strength: 0.4 })
  return <button ref={ref}>Hover me</button>
}

export default function App() {
  return (
    <>
      <MagnetCursor color="#000" />
      <MagnetButton />
      {/* only the dot moves; the tile stays as the hover area */}
      <Magnet className="tile" target=".dot" strength={0.5}>
        <span className="dot" />
      </Magnet>
    </>
  )
}
```

**Exports:** `<MagnetCursor>`, `<Magnet>`, `<GravitationalLiquid>`, `useMagnetCursor()`,
`useMagnet()`, `useGravitationalLiquid()`, plus everything from
`@joihouse/magnet-cursor-core`.

Requires React `>=17`. In the Next.js App Router, render `<MagnetCursor />` inside a `'use client'`
boundary.

**[Full documentation →](https://github.com/JoiHouse/magnet-cursor)**

MIT © joihouse
