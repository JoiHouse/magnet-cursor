import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/** Anything a template ref can hold and still resolve to a DOM element. */
export type MagnetElementSource = MaybeRefOrGetter<
  HTMLElement | { $el?: unknown } | null | undefined
>

export const resolveElement = (source: MagnetElementSource): HTMLElement | null => {
  // `useMagnet` and `useGravitationalLiquid` read this from an immediate
  // watcher, which Vue does run during server-side `setup()`. A template ref
  // is null there, but a getter can hand back a live object, and the
  // `instanceof HTMLElement` below would then throw a ReferenceError on Node.
  if (typeof HTMLElement === 'undefined') return null
  const value = toValue(source)
  if (!value) return null
  if (value instanceof HTMLElement) return value
  const el = (value as { $el?: unknown }).$el
  return el instanceof HTMLElement ? el : null
}
