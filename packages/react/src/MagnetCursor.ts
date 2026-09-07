import type { MagnetCursorOptions } from '@joihouse/magnet-cursor-core'
import { useMagnetCursor } from './useMagnetCursor'

export type MagnetCursorProps = MagnetCursorOptions

/**
 * Renderless component that mounts the custom cursor while it is alive.
 *
 * Render it once near the root of the app. In Next.js App Router it belongs in
 * a `'use client'` boundary.
 *
 * ```tsx
 * <MagnetCursor color="#000" hideNativeCursor />
 * ```
 */
export function MagnetCursor(props: MagnetCursorProps): null {
  useMagnetCursor(props)
  return null
}

export default MagnetCursor
