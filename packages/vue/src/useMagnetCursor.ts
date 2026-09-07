import { createMagnetCursor } from '@joihouse/magnet-cursor-core'
import type { MagnetCursorInstance, MagnetCursorOptions } from '@joihouse/magnet-cursor-core'
import { onMounted, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'

export interface UseMagnetCursorReturn {
  /** The live instance, or `null` before mount / on unsupported devices. */
  instance: ShallowRef<MagnetCursorInstance | null>
  /** Tear the cursor down early. Also runs automatically on scope dispose. */
  stop: () => void
}

/**
 * Mount the custom cursor for the lifetime of the calling component.
 *
 * Nothing runs during SSR: the instance is created in `onMounted` and disposed
 * with the effect scope. Reactive options are forwarded via `setOptions`.
 */
export function useMagnetCursor(
  options: MaybeRefOrGetter<MagnetCursorOptions> = {},
): UseMagnetCursorReturn {
  const instance = shallowRef<MagnetCursorInstance | null>(null)

  const stop = () => {
    instance.value?.destroy()
    instance.value = null
  }

  onMounted(() => {
    instance.value = createMagnetCursor(toValue(options))
  })

  watch(
    () => toValue(options),
    (next) => instance.value?.setOptions(next),
    { deep: true },
  )

  onScopeDispose(stop)

  return { instance, stop }
}
