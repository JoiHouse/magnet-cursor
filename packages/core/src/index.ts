export { createMagnetCursor } from './cursor'
export type {
  MagnetCursorInstance,
  MagnetCursorOptions,
  MagnetCursorLiquidOptions,
  MagnetCursorTrailOptions,
  MagnetCursorMorphOptions,
  MagnetCursorIdleOptions,
  MagnetCursorThemeOptions,
  MagnetCursorUnderlineOptions,
  UnderlineDirection,
  UnderlineStyle,
  ResolvedTheme,
  ThemeMode,
} from './cursor'

export {
  DEFAULT_DARK_SELECTOR,
  DEFAULT_LIGHT_SELECTOR,
  createThemeWatcher,
  detectTheme,
} from './theme'
export type { ThemeWatcher, ThemeWatcherOptions } from './theme'

export { createGravitationalLiquid } from './gravitational-liquid'
export type {
  GravitationalLiquidInstance,
  GravitationalLiquidOptions,
} from './gravitational-liquid'

export { createMagnet } from './magnet'
export type { MagnetInstance, MagnetOptions, MagnetState, MagnetTarget } from './magnet'

export { clamp, isBrowser, isPointerDevice, lerp, prefersReducedMotion } from './env'
