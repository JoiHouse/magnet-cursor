import type { MagnetOptions, MagnetTarget } from '@joihouse/magnet-cursor-core'
import { createElement } from 'react'
import type { ComponentPropsWithoutRef, ElementType, ReactElement, ReactNode } from 'react'
import { useMagnet } from './useMagnet'

const MAGNET_OPTION_KEYS = [
  'target',
  'strength',
  'padding',
  'clampRatio',
  'maxMove',
  'axis',
  'scale',
  'activeTransition',
  'releaseTransition',
  'disabled',
  'detectPointer',
  'respectReducedMotion',
  'onEnter',
  'onMove',
  'onLeave',
] as const satisfies readonly (keyof MagnetOptions)[]

export type MagnetProps<T extends ElementType = 'div'> = MagnetOptions & {
  /** Element rendered as the hover area. Default `'div'`. */
  as?: T
  /**
   * The magnet's target, for when `target` is needed by the element itself —
   * `<Magnet as="a" magnetTarget=".icon" target="_blank">`. When this is set,
   * `target` is forwarded to the DOM instead of being read as the magnet's.
   */
  magnetTarget?: MagnetTarget
  children?: ReactNode
} & Omit<
    ComponentPropsWithoutRef<T>,
    Exclude<keyof MagnetOptions, 'target'> | 'as' | 'children' | 'magnetTarget'
  >

/**
 * Wrapper component that makes its rendered element magnetic.
 *
 * ```tsx
 * <Magnet as="button" strength={0.4} className="btn">Hover me</Magnet>
 * <Magnet as="a" href="…" magnetTarget=".icon" target="_blank">External</Magnet>
 * ```
 *
 * Prefer {@link useMagnet} when you already control the element's ref.
 */
export function Magnet<T extends ElementType = 'div'>(props: MagnetProps<T>): ReactElement {
  const { as, children, magnetTarget, ...rest } = props as MagnetProps<'div'> & {
    as?: ElementType
  }

  // `target` means two different things on an anchor. Naming the magnet's own
  // target explicitly hands `target` back to the element, so an external link
  // can be magnetic without losing `target="_blank"`.
  const retargeted = magnetTarget !== undefined

  const options: Record<string, unknown> = {}
  const domProps: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (key === 'target' && retargeted) {
      domProps.target = value
    } else if ((MAGNET_OPTION_KEYS as readonly string[]).includes(key)) {
      if (value !== undefined) options[key] = value
    } else {
      domProps[key] = value
    }
  }
  if (retargeted) options.target = magnetTarget

  const { ref } = useMagnet<HTMLElement>(options as MagnetOptions)

  return createElement(as ?? 'div', { ...domProps, ref }, children)
}

export default Magnet
