import { createGravitationalLiquid } from '@joihouse/magnet-cursor-core'
import type {
  GravitationalLiquidInstance,
  GravitationalLiquidOptions,
} from '@joihouse/magnet-cursor-core'
import type { DirectiveBinding, ObjectDirective } from 'vue'

const instances = new WeakMap<HTMLElement, GravitationalLiquidInstance>()

/**
 * `v-gravitational-liquid` — the directive form of {@link createGravitationalLiquid}.
 *
 * ```vue
 * <button v-gravitational-liquid>Hover me</button>
 * <button v-gravitational-liquid="{ liquidColor: '#ff3737', size: 120 }">Bigger blob</button>
 * ```
 *
 * `getSSRProps` is defined so Nuxt and `@vue/server-renderer` never warn about
 * a client-only directive.
 */
export const vGravitationalLiquid: ObjectDirective<
  HTMLElement,
  GravitationalLiquidOptions | undefined
> = {
  getSSRProps: () => ({}),

  mounted(el: HTMLElement, binding: DirectiveBinding<GravitationalLiquidOptions | undefined>) {
    instances.set(el, createGravitationalLiquid(el, binding.value ?? {}))
  },

  updated(el: HTMLElement, binding: DirectiveBinding<GravitationalLiquidOptions | undefined>) {
    if (binding.value === binding.oldValue) return
    instances.get(el)?.setOptions(binding.value ?? {})
  },

  unmounted(el: HTMLElement) {
    instances.get(el)?.destroy()
    instances.delete(el)
  },
}

export default vGravitationalLiquid
