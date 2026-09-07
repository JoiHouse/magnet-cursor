import type { App, Plugin } from 'vue'
import { GravitationalLiquid } from './GravitationalLiquid'
import { Magnet } from './Magnet'
import { MagnetCursor } from './MagnetCursor'
import { vGravitationalLiquid } from './liquid-directive'
import { vMagnet } from './directive'

export interface MagnetCursorPluginOptions {
  /** Name the magnet directive is registered under, without the `v-`. Default `'magnet'`. */
  directiveName?: string
  /**
   * Name the liquid directive is registered under, without the `v-`.
   * Default `'gravitational-liquid'`.
   */
  liquidDirectiveName?: string
  /** Also register the three components globally. Default `true`. */
  registerComponents?: boolean
}

/**
 * Vue plugin that registers `v-magnet` and `v-gravitational-liquid` (and, by
 * default, the components too).
 *
 * ```ts
 * app.use(MagnetCursorPlugin)
 * ```
 */
export const MagnetCursorPlugin: Plugin<[MagnetCursorPluginOptions?]> = {
  install(app: App, options: MagnetCursorPluginOptions = {}) {
    const {
      directiveName = 'magnet',
      liquidDirectiveName = 'gravitational-liquid',
      registerComponents = true,
    } = options

    app.directive(directiveName, vMagnet)
    app.directive(liquidDirectiveName, vGravitationalLiquid)

    if (registerComponents) {
      app.component('MagnetCursor', MagnetCursor)
      app.component('Magnet', Magnet)
      app.component('GravitationalLiquid', GravitationalLiquid)
    }
  },
}

export default MagnetCursorPlugin
