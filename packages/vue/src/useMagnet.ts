import { createMagnet } from '@joihouse/magnet-cursor-core'
import type { MagnetInstance, MagnetOptions } from '@joihouse/magnet-cursor-core'
import { onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import { resolveElement } from './element'
import type { MagnetElementSource } from './element'

export type { MagnetElementSource }

export interface UseMagnetReturn {
  /** The live instance, or `null` while the element is not mounted. */
  instance: ShallowRef<MagnetInstance | null>
  /** Snap the target back to its origin. */
  reset: () => void
  /** Tear the effect down early. Also runs automatically on scope dispose. */
  stop: () => void
}

/**
 * Attach the magnetic hover effect to a template ref.
 *
 * The instance is rebuilt whenever the element itself changes and updated in
 * place when only the options change.
 */
export function useMagnet(
  element: MagnetElementSource,
  options: MaybeRefOrGetter<MagnetOptions> = {},
): UseMagnetReturn {
  const instance = shallowRef<MagnetInstance | null>(null)

  const stop = () => {
    instance.value?.destroy()
    instance.value = null
  }

  watch(
    () => resolveElement(element),
    (el) => {
      stop()
      if (el) instance.value = createMagnet(el, toValue(options))
    },
    { immediate: true, flush: 'post' },
  )

  watch(
    () => toValue(options),
    (next) => instance.value?.setOptions(next),
    { deep: true },
  )

  onScopeDispose(stop)

  return { instance, reset: () => instance.value?.reset(), stop }
}
