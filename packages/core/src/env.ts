/** Runtime/environment guards shared by every effect. All of them are SSR safe. */

export const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined'

/**
 * Whether the current device is driven by a precise pointer (a real mouse or trackpad).
 *
 * Touch-only devices have no hover state, so every pointer driven effect in this
 * package is a no-op there instead of leaving a stuck element behind.
 */
export const isPointerDevice = (): boolean => {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return false

  const hasHover = window.matchMedia('(hover: hover)').matches
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches
  if (hasHover && hasFinePointer) return true

  // Fallback for browsers with unreliable media queries: treat anything that is
  // not a known mobile/tablet UA and exposes no touch points as a mouse device.
  const ua = navigator.userAgent.toLowerCase()
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(ua)
  const isTablet = /ipad|android(?!.*mobile)/.test(ua)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  return !isMobile && !isTablet && !hasTouch
}

/** Whether the user asked the OS to reduce motion. */
export const prefersReducedMotion = (): boolean => {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Linear interpolation. `n` is the per-frame easing factor in the 0..1 range. */
export const lerp = (from: number, to: number, n: number): number => (1 - n) * from + n * to

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)
