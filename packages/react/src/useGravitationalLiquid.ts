import { createGravitationalLiquid } from '@joihouse/magnet-cursor-core'
import type {
  GravitationalLiquidInstance,
  GravitationalLiquidOptions,
} from '@joihouse/magnet-cursor-core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLatest, useOptionsSignature } from './internal'

export interface UseGravitationalLiquidReturn<T extends HTMLElement> {
  /** Callback ref to spread onto the surface: `<button ref={ref}>`. */
  ref: (node: T | null) => void
  /** Escape hatch for the live instance. */
  instanceRef: React.RefObject<GravitationalLiquidInstance | null>
}

/**
 * Erode an element's surface with a liquid blob drawn to the pointer.
 *
 * ```tsx
 * const { ref } = useGravitationalLiquid<HTMLButtonElement>({ liquidColor: '#ff3737' })
 * return <button ref={ref}>Hover me</button>
 * ```
 */
export function useGravitationalLiquid<T extends HTMLElement = HTMLElement>(
  options: GravitationalLiquidOptions = {},
): UseGravitationalLiquidReturn<T> {
  const optionsRef = useLatest(options)
  const instanceRef = useRef<GravitationalLiquidInstance | null>(null)
  const [node, setNode] = useState<T | null>(null)

  // The element arrives through state rather than being captured inside the ref
  // callback, so creation and teardown share one effect lifecycle. Creating in
  // the ref while destroying in a separate unmount effect is what React 18's
  // StrictMode breaks: it double-invokes effects but attaches a stable callback
  // ref only once, so the cleanup tears the instance down and nothing is left
  // to rebuild it.
  const ref = useCallback((next: T | null) => setNode(next), [])

  useEffect(() => {
    if (!node) return

    const instance = createGravitationalLiquid(node, optionsRef.current)
    instanceRef.current = instance

    return () => {
      instance.destroy()
      instanceRef.current = null
    }
  }, [node, optionsRef])

  const signature = useOptionsSignature(options)
  useEffect(() => {
    instanceRef.current?.setOptions(optionsRef.current)
  }, [signature, optionsRef])

  return { ref, instanceRef }
}
