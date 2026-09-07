import { createApp } from 'vue'
import { describe, expect, it } from 'vitest'
import { GravitationalLiquid } from '../src/GravitationalLiquid'
import { Magnet } from '../src/Magnet'
import { MagnetCursor } from '../src/MagnetCursor'
import { vGravitationalLiquid } from '../src/liquid-directive'
import { vMagnet } from '../src/directive'
import { MagnetCursorPlugin } from '../src/plugin'

describe('MagnetCursorPlugin', () => {
  it('registers both directives and all three components by default', () => {
    const app = createApp({ render: () => null })
    app.use(MagnetCursorPlugin)

    expect(app.directive('magnet')).toBe(vMagnet)
    expect(app.directive('gravitational-liquid')).toBe(vGravitationalLiquid)
    expect(app.component('MagnetCursor')).toBe(MagnetCursor)
    expect(app.component('Magnet')).toBe(Magnet)
    expect(app.component('GravitationalLiquid')).toBe(GravitationalLiquid)
  })

  it('honours custom directive names and can skip the components', () => {
    const app = createApp({ render: () => null })
    app.use(MagnetCursorPlugin, {
      directiveName: 'pull',
      liquidDirectiveName: 'goo',
      registerComponents: false,
    })

    expect(app.directive('pull')).toBe(vMagnet)
    expect(app.directive('goo')).toBe(vGravitationalLiquid)
    expect(app.directive('magnet')).toBeUndefined()
    expect(app.component('MagnetCursor')).toBeUndefined()
    expect(app.component('Magnet')).toBeUndefined()
    expect(app.component('GravitationalLiquid')).toBeUndefined()
  })
})
