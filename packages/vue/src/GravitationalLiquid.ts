import type { GravitationalLiquidOptions } from '@joihouse/magnet-cursor-core/gravitational-liquid'
import { defineComponent, h, shallowRef } from 'vue'
import { useGravitationalLiquid } from './useGravitationalLiquid'

/**
 * Wrapper component whose rendered element is eroded by a liquid blob.
 *
 * ```vue
 * <GravitationalLiquid as="button" class="btn" liquid-color="#ff3737">
 *   Hover me
 * </GravitationalLiquid>
 * ```
 *
 * Prefer the `v-gravitational-liquid` directive when you do not want an extra
 * component in the tree; this exists for templates that would rather pass typed
 * props.
 */
export const GravitationalLiquid = defineComponent({
  name: 'GravitationalLiquid',
  inheritAttrs: true,
  props: {
    /** Tag rendered as the eroded surface. Default `'div'`. */
    as: { type: String, default: 'div' },
    surface: String,
    liquidColor: String,
    size: Number,
    rounded: Number,
    damping: Number,
    elasticity: Number,
    tension: Number,
    maxStretch: Number,
    hideCursor: { type: Boolean, default: undefined },
    detectPointer: { type: Boolean, default: undefined },
    respectReducedMotion: { type: Boolean, default: undefined },
  },
  setup(props, { slots }) {
    const el = shallowRef<HTMLElement | null>(null)

    useGravitationalLiquid(el, () => {
      const options: GravitationalLiquidOptions = {}
      for (const [key, value] of Object.entries(props)) {
        if (key !== 'as' && value !== undefined) (options as Record<string, unknown>)[key] = value
      }
      return options
    })

    return () => h(props.as, { ref: el }, slots.default?.())
  },
})

export default GravitationalLiquid
