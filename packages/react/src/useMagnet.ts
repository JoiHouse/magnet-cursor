import { createMagnet } from '@joihouse/magnet-cursor-core'
import type { MagnetInstance, MagnetOptions } from '@joihouse/magnet-cursor-core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLatest, useOptionsSignature, withoutFunctions } from './internal'

export interface UseMagnetReturn<T extends HTMLElement> {
  /** Callback ref to spread onto the hover area: `<button ref={ref}>`. */
  ref: (node: T | null) => void
  /** Snap the target back to its origin. */
  reset: () => void
  /** Escape hatch for the live instance. */
  instanceRef: React.RefObject<MagnetInstance | null>
}

/**
 * Attach the magnetic hover effect to an element via a callback ref.
 *
 * ```tsx
 * const { ref } = useMagnet<HTMLButtonElement>({ strength: 0.4 })
 * return <button ref={ref}>Hover me</button>
 * ```
 */
export function useMagnet<T extends HTMLElement = HTMLElement>(
  options: MagnetOptions = {},
): UseMagnetReturn<T> {
  const optionsRef = useLatest(options)
  const instanceRef = useRef<MagnetInstance | null>(null)
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

    const instance = createMagnet(node, {
      ...optionsRef.current,
      onEnter: (state) => optionsRef.current.onEnter?.(state),
      onMove: (state) => optionsRef.current.onMove?.(state),
      onLeave: () => optionsRef.current.onLeave?.(),
    })
    instanceRef.current = instance

    return () => {
      instance.destroy()
      instanceRef.current = null
    }
  }, [node, optionsRef])

  const signature = useOptionsSignature(options)
  useEffect(() => {
    instanceRef.current?.setOptions(withoutFunctions(optionsRef.current))
  }, [signature, optionsRef])

  return {
    ref,
    reset: () => instanceRef.current?.reset(),
    instanceRef,
  }
}
