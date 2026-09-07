import { clamp, isBrowser, isPointerDevice, prefersReducedMotion } from './env'
import { cancelTick, scheduleTick } from './frame'
import type { FrameTick } from './frame'
import { createLiquidSurface } from './liquid-surface'
import type { LiquidSurface } from './liquid-surface'
import {
  approach,
  createSpring2,
  resetSpring2,
  resolveSpring,
  spring2Settled,
  stepSpring2,
  wrapHalfTurn,
} from './spring'
import type { SpringConfig } from './spring'

export interface GravitationalLiquidOptions {
  /** Paint of the surface being eroded. Defaults to the element's own background colour. */
  surface?: string
  /** Colour revealed through the erosion. Default `'#ff3737'`. */
  liquidColor?: string
  /** Diameter of the blob in px. Default `80`. */
  size?: number
  /** Corner radius of the surface in px. Defaults to the element's own. */
  rounded?: number
  /** How lazily the blob is drawn towards the pointer, 0..100. Default `55`. */
  damping?: number
  /**
   * How much of the arrival overshoots, 0..1. `0` never passes the pointer;
   * `1` swings well past it and comes back. Default `0.25`.
   */
  elasticity?: number
  /** Surface tension: blur radius of the goo filter, px. Default `8`. */
  tension?: number
  /** Upper bound of the blob's elongation. Default `1.6`. */
  maxStretch?: number
  /** Hide the global cursor while the pointer is over this surface. Default `true`. */
  hideCursor?: boolean
  /** Skip everything on touch-only devices. Default `true`. */
  detectPointer?: boolean
  /** Skip everything when the user prefers reduced motion. Default `true`. */
  respectReducedMotion?: boolean
}

export interface GravitationalLiquidInstance {
  /** The element the surface was painted onto. */
  readonly element: HTMLElement
  /** Whether the effect actually bound on this device. */
  readonly enabled: boolean
  /** Merge new options in. */
  setOptions: (options: Partial<GravitationalLiquidOptions>) => void
  /** Remove the surface and restore the element's own background. */
  destroy: () => void
}

type ResolvedOptions = Required<Omit<GravitationalLiquidOptions, 'surface' | 'rounded'>> &
  Pick<GravitationalLiquidOptions, 'surface' | 'rounded'>

const defaults: ResolvedOptions = {
  liquidColor: '#ff3737',
  size: 80,
  damping: 55,
  elasticity: 0.25,
  tension: 8,
  maxStretch: 1.6,
  hideCursor: true,
  detectPointer: true,
  respectReducedMotion: true,
}

/**
 * Force every numeric option into the range the renderer can actually draw.
 *
 * A negative blur or a `maxStretch` below 1 does not degrade gracefully — it
 * produces a shape with no meaning — so the values are clamped once, here,
 * rather than defended against at each use.
 */
const sanitize = (options: ResolvedOptions): ResolvedOptions => ({
  ...options,
  size: Math.max(1, options.size),
  damping: clamp(options.damping, 0, 100),
  elasticity: clamp(options.elasticity, 0, 1),
  tension: Math.max(0, options.tension),
  maxStretch: Math.max(1, options.maxStretch),
  rounded: options.rounded === undefined ? undefined : Math.max(0, options.rounded),
})

/** Timestep assumed when a frame has no measurable predecessor. */
const NOMINAL_FRAME = 1 / 60
/** Longest timestep the loop integrates, so a backgrounded tab cannot teleport the blob. */
const MAX_FRAME = 0.05

/** Time constants of the scalars that ride along with the spring, in seconds. */
const STRETCH_TAU = 0.09
const BITE_TAU = 0.12
const ANGLE_TAU = 0.06

/**
 * Lag, in blob radii, that produces the full `maxStretch`.
 *
 * Normalising by the radius rather than by an absolute pixel count keeps the
 * feel identical when `size` changes: a big blob has to fall proportionally
 * further behind before it looks stretched.
 */
const STRETCH_LAG_SPAN = 2.5
/** Lag, in blob radii, below which the travel direction is frozen. */
const ANGLE_FLOOR = 0.04

/** Below these the scalar counts as arrived. */
const STRETCH_EPSILON = 0.002
const BITE_EPSILON = 0.002

/**
 * Document level state shared by every live instance, so the global cursor is
 * only un-suppressed once the pointer has left the last liquid surface.
 */
let suppressors = 0

const CURSOR_ATTRIBUTE = 'data-magnet-cursor-gravitating'

/** `rgba(…, 0)` and the `transparent` keyword both make the effect meaningless. */
const isTransparent = (paint: string): boolean =>
  paint === 'transparent' || /,\s*0\s*\)$/.test(paint)

let warnedTransparent = false

/**
 * Erode an element's surface with a liquid blob that is gravitationally drawn
 * to the pointer.
 *
 * The blob is subtractive, not additive: an SVG mask knocks a circular hole out
 * of the surface, then a goo filter rounds that hole into a concave bite with
 * shoulders — surface tension where the bite meets an edge. A layer behind the
 * surface shows `liquidColor` through the erosion, so it reads on any
 * background.
 *
 * The follow is a damped spring rather than an exponential ease, so the blob
 * carries momentum: with `elasticity` above 0 it is thrown past the pointer and
 * drawn back, and the elongation is driven by how far it has fallen behind.
 *
 * The element's own background is taken over and repainted, so the effect drops
 * onto existing markup:
 *
 * ```ts
 * const liquid = createGravitationalLiquid(button, { liquidColor: '#ff3737' })
 * // later
 * liquid.destroy()
 * ```
 */
export function createGravitationalLiquid(
  element: HTMLElement,
  options: GravitationalLiquidOptions = {},
): GravitationalLiquidInstance {
  let opts = sanitize({ ...defaults, ...options })

  const inert: GravitationalLiquidInstance = {
    element,
    enabled: false,
    setOptions: () => {},
    destroy: () => {},
  }

  if (!isBrowser() || !element) return inert
  if (opts.detectPointer && !isPointerDevice()) return inert
  if (opts.respectReducedMotion && prefersReducedMotion()) return inert

  const computed = getComputedStyle(element)
  // Restored field by field. The `background` shorthand would have swallowed an
  // element's background-image on teardown even though only the colour was ever
  // taken over.
  const ownBackgroundColor = element.style.backgroundColor
  const ownPosition = element.style.position
  const ownIsolation = element.style.isolation

  const surfacePaint = opts.surface ?? computed.backgroundColor
  if (opts.surface === undefined && isTransparent(surfacePaint) && !warnedTransparent) {
    warnedTransparent = true
    console.warn(
      '[magnet-cursor] createGravitationalLiquid: the element has no opaque background colour, ' +
        'so there is no surface to erode. Pass `surface` to name one.',
    )
  }

  const surfaceRadius = (opts.rounded ?? Number.parseFloat(computed.borderTopLeftRadius)) || 0

  if (computed.position === 'static') element.style.position = 'relative'
  // Contain the z-index:-1 surface, so it cannot slip behind an ancestor.
  element.style.isolation = 'isolate'
  element.style.backgroundColor = 'transparent'

  const surface: LiquidSurface = createLiquidSurface(element, {
    surface: surfacePaint,
    liquidColor: opts.liquidColor,
    size: opts.size,
    rounded: surfaceRadius,
    tension: opts.tension,
  })

  // Live state, all integrated over elapsed time.
  const follow = createSpring2()
  let springConfig: SpringConfig = resolveSpring(opts.damping, opts.elasticity)
  let targetX = 0
  let targetY = 0
  let stretch = 1
  let angle = 0
  let bite = 0
  let pointerX = 0
  let pointerY = 0
  let hovering = false
  let destroyed = false
  let lastTime = 0
  /**
   * Whether this instance currently holds a claim on the global suppression.
   * Tracked rather than re-derived from `hideCursor`, so toggling that option
   * mid-hover can neither leave the claim outstanding nor double-release it.
   */
  let suppressing = false

  // Written by the read phase, flushed by the write phase.
  let poseX = 0
  let poseY = 0
  let poseAngle = 0
  let poseStretch = 1
  let poseBite = 0
  let settled = false

  const measure = () => {
    if (destroyed) return

    const now = performance.now()
    const elapsed = (now - lastTime) / 1000
    const dt = lastTime === 0 || elapsed <= 0 ? NOMINAL_FRAME : Math.min(MAX_FRAME, elapsed)
    lastTime = now

    if (hovering) {
      const rect = element.getBoundingClientRect()
      targetX = pointerX - (rect.left + rect.width / 2)
      targetY = pointerY - (rect.top + rect.height / 2)
    }

    stepSpring2(follow, targetX, targetY, springConfig, dt)

    // Everything below is driven by the lag vector — how far the blob is from
    // where it is being pulled. It is the same quantity that drives the spring,
    // so the stretch can no longer disagree with the motion, and unlike a
    // per-frame step delta it does not shrink as `damping` rises.
    const lagX = targetX - follow.x
    const lagY = targetY - follow.y
    const lag = Math.sqrt(lagX * lagX + lagY * lagY)
    const radius = opts.size / 2

    const wantStretch = 1 + (opts.maxStretch - 1) * clamp(lag / (radius * STRETCH_LAG_SPAN), 0, 1)
    stretch = approach(stretch, wantStretch, dt, STRETCH_TAU)

    if (lag > radius * ANGLE_FLOOR) {
      const want = (Math.atan2(lagY, lagX) * 180) / Math.PI
      angle += wrapHalfTurn(want - angle) * (1 - Math.exp(-dt / ANGLE_TAU))
    }

    const wantBite = hovering ? 1 : 0
    bite = approach(bite, wantBite, dt, BITE_TAU)

    // Everything approaches its target asymptotically, so the last frame snaps
    // onto it — otherwise the bite would sit at 0.999 forever.
    settled =
      spring2Settled(follow, targetX, targetY) &&
      Math.abs(stretch - 1) < STRETCH_EPSILON &&
      Math.abs(wantBite - bite) < BITE_EPSILON
    if (settled) {
      resetSpring2(follow, targetX, targetY)
      stretch = 1
      bite = wantBite
    }

    poseX = follow.x
    poseY = follow.y
    poseAngle = angle
    poseStretch = stretch
    poseBite = bite
  }

  const commit = () => {
    if (destroyed) return

    surface.setPose(poseX, poseY, poseAngle, poseStretch, poseBite)

    // Keep going while anything is still in motion. Once the blob has caught up
    // with the pointer and the shape has relaxed, the loop costs nothing until
    // the pointer moves again.
    if (settled) {
      lastTime = 0
      return
    }
    scheduleTick(tick)
  }

  const tick: FrameTick = { measure, commit }

  const wake = () => {
    if (destroyed) return
    if (lastTime === 0) lastTime = performance.now()
    scheduleTick(tick)
  }

  const suppressCursor = () => {
    if (suppressing || !opts.hideCursor) return
    suppressing = true
    suppressors += 1
    document.documentElement.setAttribute(CURSOR_ATTRIBUTE, 'true')
  }

  const releaseCursor = () => {
    if (!suppressing) return
    suppressing = false
    suppressors -= 1
    if (suppressors <= 0) {
      suppressors = 0
      document.documentElement.removeAttribute(CURSOR_ATTRIBUTE)
    }
  }

  /**
   * The loop parks itself once the blob has arrived, which means nothing is
   * re-reading the element's box. A scroll or a reflow under a motionless
   * pointer would then leave the bite behind at a stale offset, so both wake it
   * for one more pass.
   */
  const onGeometryChange = () => {
    if (hovering) wake()
  }

  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          surface.fitRegion()
          onGeometryChange()
        })
  observer?.observe(element)

  const onEnter = (event: PointerEvent) => {
    pointerX = event.clientX
    pointerY = event.clientY

    // Land the blob where the pointer entered instead of sliding it in from the
    // last place it was seen.
    const rect = element.getBoundingClientRect()
    targetX = pointerX - (rect.left + rect.width / 2)
    targetY = pointerY - (rect.top + rect.height / 2)
    if (!hovering) {
      resetSpring2(follow, targetX, targetY)
      window.addEventListener('scroll', onGeometryChange, { capture: true, passive: true })
    }

    hovering = true
    suppressCursor()
    wake()
  }

  const onMove = (event: PointerEvent) => {
    if (!hovering) {
      onEnter(event)
      return
    }
    pointerX = event.clientX
    pointerY = event.clientY
    wake()
  }

  const onLeave = () => {
    if (!hovering) return
    releaseCursor()
    hovering = false
    window.removeEventListener('scroll', onGeometryChange, { capture: true })
    wake()
  }

  element.addEventListener('pointerenter', onEnter)
  element.addEventListener('pointermove', onMove, { passive: true })
  element.addEventListener('pointerleave', onLeave)

  return {
    element,
    enabled: true,

    setOptions(next) {
      opts = sanitize({ ...opts, ...next })

      if (next.damping !== undefined || next.elasticity !== undefined) {
        springConfig = resolveSpring(opts.damping, opts.elasticity)
      }
      if (next.tension !== undefined) surface.setTension(opts.tension)
      if (next.size !== undefined) surface.setSize(opts.size)
      if (next.liquidColor !== undefined) surface.setLiquidColor(opts.liquidColor)
      if (next.surface !== undefined) surface.setSurface(opts.surface as string)
      if (next.rounded !== undefined) surface.setRounded(opts.rounded as number)

      // `hideCursor` has to be reconciled in both directions: it can be turned
      // on while the pointer is already inside, which no event will follow up.
      if (hovering && opts.hideCursor) suppressCursor()
      if (!opts.hideCursor) releaseCursor()

      // Geometry the loop would otherwise only notice on the next pointer move.
      if (!settled || hovering) wake()
    },

    destroy() {
      if (destroyed) return
      releaseCursor()
      destroyed = true
      cancelTick(tick)
      observer?.disconnect()
      window.removeEventListener('scroll', onGeometryChange, { capture: true })
      element.removeEventListener('pointerenter', onEnter)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      surface.destroy()
      element.style.backgroundColor = ownBackgroundColor
      element.style.position = ownPosition
      element.style.isolation = ownIsolation
    },
  }
}
