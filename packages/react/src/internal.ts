import { useRef } from 'react'

/** Keep the newest value readable from stable callbacks without re-running effects. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

/** Drop callbacks so `setOptions` never replaces the stable event proxies. */
export function withoutFunctions<T extends object>(options: T): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(options)) {
    if (typeof value !== 'function') result[key] = value
  }
  return result as Partial<T>
}

/**
 * Returns a counter that only changes when a non-function option changes.
 *
 * Option objects are usually written inline, so their identity changes on every
 * render; without this the effect below would push options every single render.
 */
export function useOptionsSignature(options: object): number {
  const previous = useRef<Record<string, unknown>>({})
  const version = useRef(0)

  const next = withoutFunctions(options) as Record<string, unknown>
  const keys = new Set([...Object.keys(previous.current), ...Object.keys(next)])
  for (const key of keys) {
    if (!Object.is(previous.current[key], next[key])) {
      previous.current = next
      version.current += 1
      break
    }
  }

  return version.current
}
