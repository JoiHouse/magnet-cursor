import type { GravitationalLiquidOptions } from '@joihouse/magnet-cursor-core/gravitational-liquid'
import { createElement } from 'react'
import type { ComponentPropsWithoutRef, ElementType, ReactElement, ReactNode } from 'react'
import { useGravitationalLiquid } from './useGravitationalLiquid'

const LIQUID_OPTION_KEYS = [
  'surface',
  'liquidColor',
  'size',
  'rounded',
  'damping',
  'elasticity',
  'tension',
  'maxStretch',
  'hideCursor',
  'detectPointer',
  'respectReducedMotion',
] as const satisfies readonly (keyof GravitationalLiquidOptions)[]

export type GravitationalLiquidProps<T extends ElementType = 'div'> = GravitationalLiquidOptions & {
  /** Element rendered as the eroded surface. Default `'div'`. */
  as?: T
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, keyof GravitationalLiquidOptions | 'as' | 'children'>

/**
 * Wrapper component whose rendered element is eroded by a liquid blob.
 *
 * ```tsx
 * <GravitationalLiquid as="button" className="btn" liquidColor="#ff3737">
 *   Hover me
 * </GravitationalLiquid>
 * ```
 *
 * Prefer {@link useGravitationalLiquid} when you already control the element's ref.
 */
export function GravitationalLiquid<T extends ElementType = 'div'>(
  props: GravitationalLiquidProps<T>,
): ReactElement {
  const { as, children, ...rest } = props as GravitationalLiquidProps<'div'> & { as?: ElementType }

  const options: Record<string, unknown> = {}
  const domProps: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if ((LIQUID_OPTION_KEYS as readonly string[]).includes(key)) {
      if (value !== undefined) options[key] = value
    } else {
      domProps[key] = value
    }
  }

  const { ref } = useGravitationalLiquid<HTMLElement>(options as GravitationalLiquidOptions)

  return createElement(as ?? 'div', { ...domProps, ref }, children)
}

export default GravitationalLiquid
