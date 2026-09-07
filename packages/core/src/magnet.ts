import { clamp, isBrowser, isPointerDevice, prefersReducedMotion } from './env'
import { cancelTick, scheduleTick } from './frame'
import type { FrameTick } from './frame'

/** Element that receives the transform, resolved lazily against the trigger element. */
export type MagnetTarget =
  HTMLElement | string | ((trigger: HTMLElement) => HTMLElement | null | undefined)

export interface MagnetState {
  /** Applied horizontal offset in px. */
  x: number
  /** Applied vertical offset in px. */
  y: number
  /** Pointer position relative to the trigger centre, in px. */
  deltaX: number
  deltaY: number
}

export interface MagnetOptions {
  /**
   * What actually moves. A string is used as `trigger.querySelector(...)`.
   * Defaults to the trigger element itself.
   */
  target?: MagnetTarget
  /** How much of the pointer offset is followed, 0..1. Default `0.3`. */
  strength?: number
  /** Extra travel added on top of `size * clampRatio`, in px. Default `16`. */
  padding?: number
  /** Fraction of the trigger size the target may travel. Default `0.5`. */
  clampRatio?: number
  /** Hard travel limit in px, overriding `clampRatio` / `padding`. */
  maxMove?: number | { x: number; y: number }
  /** Restrict movement to one axis. Default `'both'`. */
  axis?: 'both' | 'x' | 'y'
  /** Uniform scale applied to the target while the pointer is inside. */
  scale?: number
  /** Transition used while following the pointer. Default `'none'`. */
  activeTransition?: string
  /** Transition used when snapping back. Default a soft ease-out over 450ms. */
  releaseTransition?: string
  /** Turn the effect off without destroying it. Default `false`. */
  disabled?: boolean
  /** Skip everything on touch-only devices. Default `true`. */
  detectPointer?: boolean
  /** Skip everything when the user prefers reduced motion. Default `true`. */
  respectReducedMotion?: boolean
  onEnter?: (state: MagnetState) => void
  onMove?: (state: MagnetState) => void
  onLeave?: () => void
}

export interface MagnetInstance {
  /** The element the listeners are bound to. */
  readonly trigger: HTMLElement
  /** The element being transformed. */
  readonly target: HTMLElement | null
  /** Whether the effect actually bound on this device. */
  readonly enabled: boolean
  /** Merge new options in. */
  setOptions: (options: Partial<MagnetOptions>) => void
  /** Snap the target back to its origin immediately. */
  reset: () => void
  /** Remove listeners and clear the applied transform. */
  destroy: () => void
}

/** Options with every defaulted field guaranteed present. */
type ResolvedOptions = MagnetOptions &
  Required<
    Pick<
      MagnetOptions,
      | 'strength'
      | 'padding'
      | 'clampRatio'
      | 'axis'
      | 'activeTransition'
      | 'releaseTransition'
      | 'disabled'
      | 'detectPointer'
      | 'respectReducedMotion'
    >
  >

const defaults: ResolvedOptions = {
  strength: 0.3,
  padding: 16,
  clampRatio: 0.5,
  axis: 'both',
  activeTransition: 'none',
  releaseTransition: 'transform 0.45s cubic-bezier(0.23, 1, 0.32, 1)',
  disabled: false,
  detectPointer: true,
  respectReducedMotion: true,
}

const resolveTarget = (trigger: HTMLElement, target: MagnetTarget | undefined): HTMLElement => {
  if (!target) return trigger
  if (typeof target === 'string') return trigger.querySelector<HTMLElement>(target) ?? trigger
  if (typeof target === 'function') return target(trigger) ?? trigger
  return target
}

/**
 * Make an element lean toward the pointer while it is hovered, then spring back.
 *
 * Listeners are bound to `trigger` (the hover area) while the transform is
 * written to `options.target` (defaults to the trigger). Keeping the two apart
 * means the hit area stays still while the visual moves, so the element cannot
 * oscillate by escaping its own hover region.
 *
 * ```ts
 * const magnet = createMagnet(button, { strength: 0.4, target: 'svg' })
 * // later
 * magnet.destroy()
 * ```
 */
export function createMagnet(trigger: HTMLElement, options: MagnetOptions = {}): MagnetInstance {
  let opts: ResolvedOptions = { ...defaults, ...options }

  const disabledInstance: MagnetInstance = {
    trigger,
    target: null,
    enabled: false,
    setOptions: () => {},
    reset: () => {},
    destroy: () => {},
  }

  if (!isBrowser() || !trigger) return disabledInstance
  if (opts.detectPointer && !isPointerDevice()) return disabledInstance
  if (opts.respectReducedMotion && prefersReducedMotion()) return disabledInstance

  let target = resolveTarget(trigger, opts.target)
  let pointerX = 0
  let pointerY = 0
  let hovering = false
  let destroyed = false

  // Filled by the read phase, drained by the write phase of the same frame.
  let nextX = 0
  let nextY = 0
  let nextDeltaX = 0
  let nextDeltaY = 0
  let measured = false

  const write = (x: number, y: number, scale: number | undefined) => {
    const scalePart = scale === undefined ? '' : ` scale(${scale})`
    target.style.transform = `translate3d(${x}px, ${y}px, 0)${scalePart}`
  }

  const measure = () => {
    measured = false
    if (destroyed || opts.disabled || !hovering) return

    const rect = trigger.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return

    const deltaX = pointerX - (rect.left + rect.width / 2)
    const deltaY = pointerY - (rect.top + rect.height / 2)

    const limitX =
      typeof opts.maxMove === 'number'
        ? opts.maxMove
        : (opts.maxMove?.x ?? rect.width * opts.clampRatio + opts.padding)
    const limitY =
      typeof opts.maxMove === 'number'
        ? opts.maxMove
        : (opts.maxMove?.y ?? rect.height * opts.clampRatio + opts.padding)

    let x = clamp(deltaX * opts.strength, -limitX, limitX)
    let y = clamp(deltaY * opts.strength, -limitY, limitY)
    if (opts.axis === 'x') y = 0
    if (opts.axis === 'y') x = 0

    nextX = x
    nextY = y
    nextDeltaX = deltaX
    nextDeltaY = deltaY
    measured = true
  }

  const commit = () => {
    if (!measured) return
    measured = false
    write(nextX, nextY, opts.scale)
    opts.onMove?.({ x: nextX, y: nextY, deltaX: nextDeltaX, deltaY: nextDeltaY })
  }

  const tick: FrameTick = { measure, commit }
  const schedule = () => scheduleTick(tick)

  const onEnter = (event: MouseEvent) => {
    if (opts.disabled) return
    hovering = true
    pointerX = event.clientX
    pointerY = event.clientY
    target.style.transition = opts.activeTransition
    opts.onEnter?.({ x: 0, y: 0, deltaX: 0, deltaY: 0 })
    schedule()
  }

  const onMove = (event: MouseEvent) => {
    if (opts.disabled) return
    // A pointer that entered before the listener bound (or via keyboard focus
    // scroll) still needs the enter side effects applied once.
    if (!hovering) {
      hovering = true
      target.style.transition = opts.activeTransition
    }
    pointerX = event.clientX
    pointerY = event.clientY
    schedule()
  }

  const release = () => {
    hovering = false
    measured = false
    cancelTick(tick)
    target.style.transition = opts.releaseTransition
    write(0, 0, undefined)
    opts.onLeave?.()
  }

  trigger.addEventListener('mouseenter', onEnter)
  trigger.addEventListener('mousemove', onMove, { passive: true })
  trigger.addEventListener('mouseleave', release)

  return {
    trigger,
    get target() {
      return destroyed ? null : target
    },
    enabled: true,
    setOptions(next) {
      const targetChanged = 'target' in next && next.target !== opts.target
      opts = { ...opts, ...next }
      if (targetChanged) {
        release()
        target.style.transition = ''
        target = resolveTarget(trigger, opts.target)
      }
      if (opts.disabled && hovering) release()
    },
    reset: release,
    destroy() {
      if (destroyed) return
      destroyed = true
      cancelTick(tick)
      trigger.removeEventListener('mouseenter', onEnter)
      trigger.removeEventListener('mousemove', onMove)
      trigger.removeEventListener('mouseleave', release)
      target.style.transform = ''
      target.style.transition = ''
    },
  }
}
