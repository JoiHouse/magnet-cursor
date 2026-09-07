import { createGravitationalLiquid } from '@joihouse/magnet-cursor-core'
import type {
  GravitationalLiquidInstance,
  GravitationalLiquidOptions,
} from '@joihouse/magnet-cursor-core'
import { onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import { resolveElement } from './element'
import type { MagnetElementSource } from './element'

export interface UseGravitationalLiquidReturn {
  /** The live instance, or `null` while the element is not mounted. */
  instance: ShallowRef<GravitationalLiquidInstance | null>
  /** Tear the effect down early. Also runs automatically on scope dispose. */
  stop: () => void
}

/**
 * Erode a template ref's surface with a liquid blob drawn to the pointer.
 *
 * The instance is rebuilt whenever the element itself changes and updated in
 * place when only the options change.
 */
export function useGravitationalLiquid(
  element: MagnetElementSource,
  options: MaybeRefOrGetter<GravitationalLiquidOptions> = {},
): UseGravitationalLiquidReturn {
  const instance = shallowRef<GravitationalLiquidInstance | null>(null)

  const stop = () => {
    instance.value?.destroy()
    instance.value = null
  }

  watch(
    () => resolveElement(element),
    (el) => {
      stop()
      if (el) instance.value = createGravitationalLiquid(el, toValue(options))
    },
    { immediate: true, flush: 'post' },
  )

  watch(
    () => toValue(options),
    (next) => instance.value?.setOptions(next),
    { deep: true },
  )

  onScopeDispose(stop)

  return { instance, stop }
}
