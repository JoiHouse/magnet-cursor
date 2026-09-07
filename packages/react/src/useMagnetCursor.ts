import { createMagnetCursor } from '@joihouse/magnet-cursor-core'
import type { MagnetCursorInstance, MagnetCursorOptions } from '@joihouse/magnet-cursor-core'
import { useEffect, useRef, useState } from 'react'
import { useLatest, useOptionsSignature, withoutFunctions } from './internal'

/**
 * Mount the custom cursor for the lifetime of the calling component.
 *
 * Safe under SSR (`createMagnetCursor` only runs inside `useEffect`) and under
 * React 18 StrictMode double-invocation, which destroys and rebuilds cleanly.
 *
 * ```tsx
 * useMagnetCursor({ color: '#000', hideNativeCursor: true })
 * ```
 */
export function useMagnetCursor(options: MagnetCursorOptions = {}): MagnetCursorInstance | null {
  const optionsRef = useLatest(options)
  const instanceRef = useRef<MagnetCursorInstance | null>(null)
  const [instance, setInstance] = useState<MagnetCursorInstance | null>(null)

  useEffect(() => {
    const created = createMagnetCursor({
      ...optionsRef.current,
      onItemChange: (active, target) => optionsRef.current.onItemChange?.(active, target),
    })
    instanceRef.current = created
    setInstance(created)

    return () => {
      created.destroy()
      instanceRef.current = null
      setInstance(null)
    }
  }, [optionsRef])

  const signature = useOptionsSignature(options)
  useEffect(() => {
    instanceRef.current?.setOptions(withoutFunctions(optionsRef.current))
  }, [signature, optionsRef])

  return instance
}
