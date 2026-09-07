export { MagnetCursor } from './MagnetCursor'
export { Magnet } from './Magnet'
export { GravitationalLiquid } from './GravitationalLiquid'
export { vMagnet } from './directive'
export { vGravitationalLiquid } from './liquid-directive'
export { MagnetCursorPlugin } from './plugin'
export type { MagnetCursorPluginOptions } from './plugin'

export { useMagnetCursor } from './useMagnetCursor'
export type { UseMagnetCursorReturn } from './useMagnetCursor'
export { useMagnet } from './useMagnet'
export type { MagnetElementSource, UseMagnetReturn } from './useMagnet'
export { useGravitationalLiquid } from './useGravitationalLiquid'
export type { UseGravitationalLiquidReturn } from './useGravitationalLiquid'

export {
  createGravitationalLiquid,
  createMagnet,
  createMagnetCursor,
  detectTheme,
  isPointerDevice,
  prefersReducedMotion,
} from '@joihouse/magnet-cursor-core'
export type {
  GravitationalLiquidInstance,
  GravitationalLiquidOptions,
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
  MagnetInstance,
  MagnetOptions,
  MagnetState,
  MagnetTarget,
} from '@joihouse/magnet-cursor-core'
