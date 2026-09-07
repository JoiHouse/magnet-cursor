import { createMagnet } from '@joihouse/magnet-cursor-core'
import type { MagnetInstance, MagnetOptions } from '@joihouse/magnet-cursor-core'
import type { DirectiveBinding, ObjectDirective } from 'vue'

const instances = new WeakMap<HTMLElement, MagnetInstance>()

/**
 * `v-magnet` — the directive form of {@link createMagnet}.
 *
 * ```vue
 * <button v-magnet>Hover me</button>
 * <button v-magnet="{ strength: 0.5, target: 'svg' }">Move the icon only</button>
 * ```
 *
 * `getSSRProps` is defined so Nuxt and `@vue/server-renderer` never warn about
 * a client-only directive.
 */
export const vMagnet: ObjectDirective<HTMLElement, MagnetOptions | undefined> = {
  getSSRProps: () => ({}),

  mounted(el: HTMLElement, binding: DirectiveBinding<MagnetOptions | undefined>) {
    instances.set(el, createMagnet(el, binding.value ?? {}))
  },

  updated(el: HTMLElement, binding: DirectiveBinding<MagnetOptions | undefined>) {
    if (binding.value === binding.oldValue) return
    instances.get(el)?.setOptions(binding.value ?? {})
  },

  unmounted(el: HTMLElement) {
    instances.get(el)?.destroy()
    instances.delete(el)
  },
}

export default vMagnet
