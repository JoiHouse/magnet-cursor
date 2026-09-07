import { clamp, isBrowser, isPointerDevice, prefersReducedMotion } from './env'
import { createMorph, resolveMorph, sameMorph } from './morph'
import type { MagnetCursorMorphOptions, MorphInstance, MorphMode, ResolvedMorph } from './morph'
import { createUnderline, resolveUnderline, sameUnderline } from './underline'
import type {
  MagnetCursorUnderlineOptions,
  ResolvedUnderline,
  UnderlineInstance,
} from './underline'
import {
  DEFAULT_DARK_SELECTOR,
  DEFAULT_LIGHT_SELECTOR,
  createThemeWatcher,
  detectTheme,
} from './theme'
import type { ResolvedTheme, ThemeMode, ThemeWatcher } from './theme'

export type { MagnetCursorIdleOptions, MagnetCursorMorphOptions } from './morph'
export type { MagnetCursorUnderlineOptions, UnderlineDirection, UnderlineStyle } from './underline'
export type { ResolvedTheme, ThemeMode } from './theme'

/**
 * Velocity driven liquid deformation. The cursor is a perfect circle at rest and
 * is dragged out of shape while it travels.
 */
export interface MagnetCursorLiquidOptions {
  /** Enable the deformation. Default `true`. */
  enabled?: boolean
  /** Speed (px/s) that produces one unit of elongation. Default `4800`. */
  divisor?: number
  /** Upper bound of the elongation factor. Default `1.25`. */
  max?: number
  /** How far the trailing edge is pulled into a tail, 0..1. Default `0.6`. */
  tail?: number
  /**
   * Seconds the deformation takes to catch up with the current speed. This is
   * what makes the cursor lag and ease back rather than snap. Default `0.09`.
   */
  settle?: number
  /** Speed (px/s) below which the travel direction is frozen. Default `30`. */
  angleFloor?: number
}

/** Gooey trail dragged behind the cursor. Off by default: it costs a filter pass per frame. */
export interface MagnetCursorTrailOptions {
  /** Number of trailing drops. Default `2`. */
  count?: number
  /** How much lazier each successive drop is than the one ahead of it. Default `0.3`. */
  spread?: number
  /** How much smaller the last drop is than the head, 0..1. Default `0.35`. */
  taper?: number
  /**
   * Blur radius of the goo filter. Larger values merge the drops from further
   * apart. Default `3`.
   *
   * There is a ceiling, and crossing it makes the cursor vanish rather than
   * degrade: the filter blurs by `goo` and then hard-thresholds alpha, so a
   * shape survives only while its radius stays above roughly `1.13 * goo`.
   * A cursor drawn at `size * scale` therefore wants
   * `goo < size * scale * (1 - taper * count / (count + 1)) / 2.27`, and
   * anything larger silently erases the trail — and, once `goo` passes the head's
   * own radius, the cursor with it. Raise `scale` before raising `goo`.
   */
  goo?: number
  /** Side of the filtered box in px. Drops are clamped inside it. Default `320`. */
  box?: number
}

/**
 * The half of the options that may differ between light and dark.
 *
 * Only paint: geometry, selectors and behaviour stay the same in both themes,
 * because a cursor that changes size with the palette reads as a different
 * cursor rather than the same one on a different background.
 */
export interface MagnetCursorThemeOptions {
  /** Idle fill. */
  color?: string
  /** Fill while in the "item" state. */
  itemColor?: string
  /** Blur radius applied while in the "item" state. */
  blur?: number | string
  /** `mix-blend-mode` for the cursor. */
  blendMode?: string
  /** Idle scale factor. Useful when one theme needs a heavier presence. */
  scale?: number
  /** Scale factor while in the "item" state. */
  itemScale?: number
  /** Scale factor while in the "pinned" state. */
  pinScale?: number
  /** Fill or ring colour of the merged shape. `null` falls back to `itemColor`. */
  morphColor?: string | null
}

export interface MagnetCursorOptions {
  /** Base class of the generated element. Default `'magnet-cursor'`. */
  className?: string
  /** Node the cursor element is appended to. Default `document.body`. */
  container?: HTMLElement
  /**
   * Fraction of the remaining distance covered per frame on a 60Hz display, in
   * the 0..1 range. `1` snaps to the pointer, lower values trail further
   * behind. Internally this becomes a time constant, so the follow feels the
   * same at any refresh rate. Default `0.2`.
   */
  lerp?: number
  /** Elements that switch the cursor into its "item" state. */
  itemSelector?: string
  /** Elements that switch the cursor into its "pinned" state. Default `null` (off). */
  pinSelector?: string | null
  /**
   * Attribute read off the hovered element to override the cursor fill, so a
   * section can carry its own colour. Default `'data-magnet-cursor-color'`.
   */
  colorAttribute?: string
  /** Liquid deformation options, or `false` to keep the cursor a rigid circle. */
  liquid?: MagnetCursorLiquidOptions | false
  /**
   * Gooey trail options, or `false` for no trail. Off by default: the trail is
   * drawn through an SVG filter, which costs a blur and a colour matrix pass
   * over the filtered box on every frame the cursor moves.
   */
  trail?: MagnetCursorTrailOptions | false
  /**
   * Merge the cursor into whatever it is pointing at, instead of floating over
   * it. `mode: 'fill'` turns the cursor into the element's hover background,
   * `mode: 'border'` traces its outline. Off by default.
   *
   * Unlike the rest of the cursor, the merge does not follow `itemSelector`:
   * repainting an element's background is intrusive enough that it is opt-in
   * per element, through `data-magnet-cursor-morph`. See `morph.include` for
   * markup you cannot annotate.
   */
  morph?: MagnetCursorMorphOptions | false
  /**
   * Draw a line under whatever the pointer is on. Off by default.
   *
   * Opt-in per element through `data-magnet-cursor-underline`, the same way
   * the merge is — see `underline.include` for markup you cannot annotate. The
   * disc stays where it is: a rule is too thin to mark the pointer on its own,
   * so this adds to the cursor rather than replacing it.
   *
   * An element that also merges is merged and not underlined. The merge turns
   * the cursor into the element; a line under it as well would be two claims
   * at once.
   */
  underline?: MagnetCursorUnderlineOptions | false
  /**
   * Distance to the pointer (px) below which the cursor counts as settled and
   * the render loop goes idle. Default `0.1`.
   */
  threshold?: number
  /** Diameter of the cursor before scaling. Number is treated as px. Default `'10rem'`. */
  size?: number | string
  /** Idle scale factor applied to `size`. Default `0.07`. */
  scale?: number
  /** Scale factor while in the "item" state. Default `0.2`. */
  itemScale?: number
  /** Scale factor while in the "pinned" state. Default `0.26`. */
  pinScale?: number
  /** Idle fill. Default `'rgba(0, 0, 0, 0.1)'`. */
  color?: string
  /** Fill while in the "item" state. Default `'rgba(255, 255, 255, 0.64)'`. */
  itemColor?: string
  /** Blur radius applied while in the "item" state. Default `'6px'`. */
  blur?: number | string
  /**
   * `mix-blend-mode` for the cursor.
   *
   * The cursor is a filled disc drawn on top of the page, so over an
   * interactive element it covers what it is pointing at. Blending is the way
   * out: `'difference'` or `'exclusion'` invert the content underneath instead
   * of hiding it, and `'multiply'` darkens it. Default `'normal'`.
   */
  blendMode?: string
  /** Stacking order of the cursor element. Default `9999`. */
  zIndex?: number
  /**
   * Which palette to paint with.
   *
   * `'auto'` (the default) follows the page: a dark or light marker in the
   * DOM, the root's `color-scheme`, then the OS preference — re-evaluated
   * whenever any of them changes, so a theme toggle repaints the cursor
   * without a remount. `'light'` and `'dark'` are fully controlled.
   */
  theme?: ThemeMode
  /**
   * Paint applied on top of the base options while the page is dark. The two
   * are shallow merged, so anything left out keeps its light value.
   *
   * ```ts
   * createMagnetCursor({
   *   color: 'rgba(15, 23, 42, 0.16)',
   *   dark: { color: 'rgba(248, 250, 252, 0.18)' },
   * })
   * ```
   */
  dark?: MagnetCursorThemeOptions
  /**
   * Selector whose presence means the page is dark.
   * Default `'.dark, [data-theme="dark"]'`.
   */
  darkSelector?: string
  /**
   * Selector whose presence means the page is explicitly light, outranking the
   * OS preference. Default `'[data-theme="light"]'`.
   */
  lightSelector?: string
  /**
   * Element the theme markers are read from.
   *
   * Defaults to `<html>` and `<body>`, which is where every mainstream theme
   * system puts its marker. Name an app wrapper here when yours marks that
   * instead — searching the whole document is deliberately not the default,
   * because a single dark panel deep in the page would then claim the whole
   * page is dark.
   */
  themeRoot?: string
  /**
   * Hide the native OS cursor on the document element. Applied only once the
   * pointer has been located, so the page is never left with no cursor at all.
   * Default `false`.
   */
  hideNativeCursor?: boolean
  /** Skip everything on touch-only devices. Default `true`. */
  detectPointer?: boolean
  /** Skip everything when the user prefers reduced motion. Default `true`. */
  respectReducedMotion?: boolean
  /** Stop the render loop while the tab is hidden. Default `true`. */
  pauseOnHidden?: boolean
  /** Fired when the "item" state flips. */
  onItemChange?: (active: boolean, target: Element | null) => void
}

export interface MagnetCursorInstance {
  /** The generated element, or `null` when the effect stayed disabled. */
  readonly element: HTMLElement | null
  /** Whether the effect actually mounted on this device. */
  readonly enabled: boolean
  /** Merge new options in. Visual options apply immediately. */
  setOptions: (options: Partial<MagnetCursorOptions>) => void
  /**
   * Stop the render loop without tearing anything down. A paused cursor stays
   * paused across tab visibility changes until `resume` is called.
   */
  pause: () => void
  /** Restart a paused render loop. */
  resume: () => void
  /** Remove the element, listeners and the render loop. */
  destroy: () => void
}

const DEFAULT_ITEM_SELECTOR =
  '.cursor-item, button, a, input, textarea, select, [data-magnet-cursor-item]'

/** Options with every defaulted field guaranteed present. */
type ResolvedOptions = MagnetCursorOptions &
  Required<
    Pick<
      MagnetCursorOptions,
      | 'className'
      | 'lerp'
      | 'itemSelector'
      | 'pinSelector'
      | 'colorAttribute'
      | 'threshold'
      | 'size'
      | 'scale'
      | 'itemScale'
      | 'pinScale'
      | 'color'
      | 'itemColor'
      | 'blur'
      | 'blendMode'
      | 'zIndex'
      | 'theme'
      | 'darkSelector'
      | 'lightSelector'
      | 'hideNativeCursor'
      | 'detectPointer'
      | 'respectReducedMotion'
      | 'pauseOnHidden'
    >
  >

const defaults: ResolvedOptions = {
  className: 'magnet-cursor',
  lerp: 0.2,
  itemSelector: DEFAULT_ITEM_SELECTOR,
  pinSelector: null,
  colorAttribute: 'data-magnet-cursor-color',
  threshold: 0.1,
  size: '10rem',
  scale: 0.07,
  itemScale: 0.2,
  pinScale: 0.26,
  color: 'rgba(0, 0, 0, 0.1)',
  itemColor: 'rgba(255, 255, 255, 0.64)',
  blur: '6px',
  blendMode: 'normal',
  zIndex: 9999,
  theme: 'auto',
  darkSelector: DEFAULT_DARK_SELECTOR,
  lightSelector: DEFAULT_LIGHT_SELECTOR,
  hideNativeCursor: false,
  detectPointer: true,
  respectReducedMotion: true,
  pauseOnHidden: true,
}

/**
 * Sized against the default cursor, not against a blank canvas.
 *
 * The goo filter erases any shape thinner than about `1.13 * goo`, so these
 * only mean anything relative to how big the cursor actually is. At the stock
 * `size: '10rem'` and `scale: 0.07` the head is an 11px dot — radius 5.6 — and
 * the last drop is smaller still, so a `goo` of 8 rubbed out the entire trail
 * and the head with it. `3` leaves the thinnest part of the default trail about
 * a fifth of margin, and `taper` is gentle enough to keep that part from
 * dropping under the line as the drops separate.
 */
const trailDefaults: Required<MagnetCursorTrailOptions> = {
  count: 2,
  spread: 0.3,
  taper: 0.35,
  goo: 3,
  box: 320,
}

const liquidDefaults: Required<MagnetCursorLiquidOptions> = {
  enabled: true,
  divisor: 4800,
  max: 1.25,
  tail: 0.6,
  settle: 0.09,
  angleFloor: 30,
}

/** Corner radius of the undeformed cursor. */
const CIRCLE = '50%'

/**
 * Step, in percent, that the trailing corners move in.
 *
 * The tail is painted through `border-radius`, and any paint property changed
 * on a frame costs a paint pass whose price scales with the page — Chrome
 * re-walks the root layer even though the cursor sits on a layer of its own.
 * Whole-percent steps changed the value on three frames in four under a real
 * hand; five-percent steps cut that to about one in five, and the eye cannot
 * tell a 43% corner from a 45% one. See the benchmark record in
 * development/performance-benchmark.md (maintainer notes, not published).
 */
const TAIL_STEP = 5

/** Identity rows for a `feColorMatrix` that only touches alpha. */
const KEEP_RGB = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0'

/**
 * Alpha multiplier that flattens the drops to an opaque silhouette before they
 * are merged. Anything at or above `1 / SOLID_ALPHA` alpha saturates.
 *
 * It must stay below 128. WebKit reduces an `feColorMatrix` value modulo 256
 * and reads 128..255 as negative, so the `255` this used to be multiplied every
 * drop's alpha by a negative number and the whole trail rendered as nothing —
 * in Safari the gooey trail was simply invisible. `300` worked and `1000` did
 * not, which is the wraparound showing through. See the Safari notes in
 * development/safari-compat.md (maintainer notes, not published).
 *
 * `100` saturates anything down to 0.01 alpha, which is fainter than the
 * faintest fill the cursor is usable at, and leaves a wide margin under 128.
 */
const SOLID_ALPHA = 100

/** Resolve any CSS length to px, letting the browser do the unit maths. */
const resolveLength = (value: number | string, container: HTMLElement): number => {
  if (typeof value === 'number') return value
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${value}`
  container.appendChild(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  return width || 0
}

/**
 * Alpha of a CSS colour, resolved by the browser rather than parsed here.
 *
 * A throwaway element is used instead of reading the cursor's own rendered
 * colour, because the cursor's fill is transitioned — reading it mid-transition
 * returns whatever value the animation is passing through. Mounting the probe
 * inside the container also lets `var()` and `color-mix()` resolve against the
 * cascade the caller actually wrote them in.
 *
 * The computed value is parsed by syntax rather than by pulling out the fourth
 * number in the string. `color(display-p3 1 0 0 / 0.5)` — which Safari both
 * keeps in the computed value and is the main place anyone writes — has a `3`
 * in its colour space name, so counting numbers shifted the whole list by one
 * and read the alpha as `0`. The trail was then drawn fully opaque, silently:
 * right colour, right shape, wrong transparency. See the Safari notes in
 * development/safari-compat.md (maintainer notes, not published).
 */
const resolveAlpha = (value: string, container: HTMLElement): number => {
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  probe.style.color = value
  container.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()

  const open = computed.indexOf('(')
  if (open === -1) return 1
  const body = computed.slice(open + 1, computed.lastIndexOf(')'))

  // Modern syntax puts alpha after a slash — `rgb(0 0 0 / 0.1)`,
  // `color(display-p3 1 0 0 / 0.5)`, `oklch(0.7 0.1 200 / 0.35)`. Legacy syntax
  // is comma separated and only carries alpha in the `rgba()` four-value form.
  // No alpha component at all means opaque.
  const slash = body.lastIndexOf('/')
  const parts = body.split(',')
  const raw = slash !== -1 ? body.slice(slash + 1) : parts.length < 4 ? undefined : parts[3]
  if (raw === undefined) return 1

  const text = raw.trim()
  const alpha = text.endsWith('%') ? Number(text.slice(0, -1)) / 100 : Number(text)
  return Number.isFinite(alpha) && alpha > 0 ? alpha : 1
}

/** Timestep assumed when a frame has no measurable predecessor. */
const NOMINAL_FRAME = 1 / 60
/** Longest timestep the loop integrates, so a backgrounded tab cannot teleport the cursor. */
const MAX_FRAME = 0.05
/** Elongation this close to 1 counts as fully relaxed. */
const RELAXED = 0.001

/**
 * Turn the per-frame easing factor into a time constant.
 *
 * Everything downstream integrates with `1 - exp(-dt / tau)`, which depends on
 * elapsed time rather than on frame count — so the cursor travels at the same
 * rate on a 60Hz and a 120Hz display. The conversion is calibrated against
 * 60Hz, which keeps `lerp` meaning exactly what it used to.
 */
const resolveFollowTau = (factor: number): number => {
  if (factor >= 1) return 0
  if (factor <= 0) return Infinity
  return -NOMINAL_FRAME / Math.log(1 - factor)
}

const toCssLength = (value: number | string): string =>
  typeof value === 'number' ? `${value}px` : value

const resolveLiquid = (
  liquid: MagnetCursorLiquidOptions | false | undefined,
): Required<MagnetCursorLiquidOptions> | null =>
  liquid === false ? null : { ...liquidDefaults, ...liquid }

const resolveTrail = (
  trail: MagnetCursorTrailOptions | false | undefined,
): Required<MagnetCursorTrailOptions> | null =>
  trail === undefined || trail === false ? null : { ...trailDefaults, ...trail }

let trailUid = 0

/** Whether two resolved trails would build the same DOM and the same filter. */
const sameTrail = (
  a: Required<MagnetCursorTrailOptions> | null,
  b: Required<MagnetCursorTrailOptions> | null,
): boolean => {
  if (a === null || b === null) return a === b
  return (
    a.count === b.count &&
    a.spread === b.spread &&
    a.taper === b.taper &&
    a.goo === b.goo &&
    a.box === b.box
  )
}

/*
 * Document-level state is shared by every live instance, so it is reference
 * counted: tearing one cursor down must not strip the marker or the
 * cursor-hiding rule from another cursor that is still mounted.
 */
let mountedCursors = 0
const hideNativeUsers = new Map<string, number>()

/**
 * Mount a custom cursor that trails the pointer with an eased follow and reacts
 * to interactive elements.
 *
 * The element is created lazily and appended to `container`; nothing is touched
 * during SSR, on touch-only devices, or when the user prefers reduced motion.
 *
 * The render loop is on demand: it runs while the cursor is catching up to the
 * pointer and stops once it has settled, so a still pointer costs no frames.
 *
 * Nothing is drawn until the pointer has actually been located. The cursor
 * starts hidden and appears at the first reading rather than materialising in
 * the middle of the viewport and sliding over.
 *
 * ```ts
 * const cursor = createMagnetCursor({ color: '#000' })
 * // later
 * cursor.destroy()
 * ```
 */
export function createMagnetCursor(options: MagnetCursorOptions = {}): MagnetCursorInstance {
  let opts: ResolvedOptions = { ...defaults, ...options }

  const disabled: MagnetCursorInstance = {
    element: null,
    enabled: false,
    setOptions: () => {},
    pause: () => {},
    resume: () => {},
    destroy: () => {},
  }

  if (!isBrowser()) return disabled
  if (opts.detectPointer && !isPointerDevice()) return disabled
  if (opts.respectReducedMotion && prefersReducedMotion()) return disabled

  const container = opts.container ?? document.body
  const root = document.documentElement

  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')

  /**
   * The liquid body: the head and the trail drops, and nothing else.
   *
   * The goo filter goes here rather than on the root because it is destructive.
   * It flattens what it covers into a silhouette and then hard-thresholds the
   * alpha, which is what fuses the drops into the head — and what erases
   * anything thinner than roughly `1.13 * goo`. A border morph is a 2px ring, so
   * running it through the same filter deleted it outright: with a trail on, the
   * merge could never be traced, only filled. The morph layer takes an element's
   * geometry rather than the cursor's, so it has no business in the liquid body
   * anyway; it stays a sibling, still inside the root and so still under the
   * root's blend mode and modifier classes.
   */
  const bodyEl = document.createElement('div')
  el.appendChild(bodyEl)

  // The visual lives on a child rather than on the root, so the root can stay a
  // plain positioner: it carries the pointer position, the head carries the
  // deformation, and trail drops can sit beside the head in the same box.
  const headEl = document.createElement('div')
  bodyEl.appendChild(headEl)

  interface Drop {
    readonly el: HTMLElement
    readonly scale: number
    /** Mutable: a `lerp` change re-pitches the queue without rebuilding it. */
    tau: number
    x: number
    y: number
  }

  let drops: Drop[] = []
  let gooSvg: SVGSVGElement | null = null
  let morph: ResolvedMorph | null = null
  let morphEl: MorphInstance | null = null
  let underline: ResolvedUnderline | null = null
  let underlineEl: UnderlineInstance | null = null
  let underlineTarget: Element | null = null
  /** Last stage of the goo filter: fades the merged silhouette back to the fill's alpha. */
  let gooAlphaEl: SVGFEColorMatrixElement | null = null

  // Placeholders only. Nothing is drawn until a real pointer reading arrives,
  // so the cursor never flashes in the middle of the viewport on load.
  let mouseX = window.innerWidth / 2
  let mouseY = window.innerHeight / 2
  let cursorX = mouseX
  let cursorY = mouseY
  let lastAngle = 0
  /** Smoothed elongation. `1` is a circle. */
  let factor = 1

  let isItem = false
  let isPinned = false
  /** Hidden until the pointer has been located. */
  let isHidden = true
  /** Whether the pointer has ever been located. Never reset once true. */
  let seen = false
  /** Whether the next reading should be landed on rather than travelled to. */
  let needsSnap = true

  let liquid = resolveLiquid(opts.liquid)
  let trail = resolveTrail(opts.trail)
  let followTau = resolveFollowTau(opts.lerp)
  let colorOverride: string | null = null
  let lastTail = -1
  /** Seconds the pointer has been motionless, which is what drives the nudge. */
  let still = 0
  /** `size` in px; the merge interpolates between the disc and the element's box. */
  let sizePx = 0
  let morphTarget: Element | null = null
  let merged = false
  /** The morph mode the class list currently advertises. */
  let morphMode: MorphMode | undefined
  /** A merge target is held, whether or not the merge has landed yet. */
  let merging = false

  let frameId = 0
  /** Timestamp of the previous integrated frame; `0` means the loop just woke. */
  let lastTime = 0
  let paused = false
  let hidden = false
  let destroyed = false
  /** The hide-native class this instance currently holds a claim on. */
  let hideNativeClass: string | null = null

  /** Which half of the palette `paint()` reads. Kept in sync by the watcher. */
  let theme: ResolvedTheme =
    opts.theme === 'auto'
      ? detectTheme(opts.darkSelector, opts.lightSelector, opts.themeRoot)
      : opts.theme
  let themeWatcher: ThemeWatcher | null = null

  /**
   * The paint in force right now.
   *
   * In light mode this is just the base options; in dark mode the `dark`
   * overrides are layered on top. Everything that reads a colour goes through
   * here rather than through `opts`, so a theme flip is a repaint and never a
   * rebuild.
   */
  const paint = (): Required<Omit<MagnetCursorThemeOptions, 'morphColor'>> & {
    morphColor: string | null | undefined
  } => {
    const base = {
      color: opts.color,
      itemColor: opts.itemColor,
      blur: opts.blur,
      blendMode: opts.blendMode,
      scale: opts.scale,
      itemScale: opts.itemScale,
      pinScale: opts.pinScale,
      morphColor: undefined as string | null | undefined,
    }
    if (theme !== 'dark' || !opts.dark) return base
    const over = opts.dark
    return {
      color: over.color ?? base.color,
      itemColor: over.itemColor ?? base.itemColor,
      blur: over.blur ?? base.blur,
      blendMode: over.blendMode ?? base.blendMode,
      scale: over.scale ?? base.scale,
      itemScale: over.itemScale ?? base.itemScale,
      pinScale: over.pinScale ?? base.pinScale,
      morphColor: 'morphColor' in over ? over.morphColor : undefined,
    }
  }

  /**
   * The merged shape's colour, which has one more layer than the rest: the
   * dark override, then the morph's own `color`, then `itemColor` via CSS.
   */
  const morphColor = (): string | null => {
    const over = paint().morphColor
    if (over !== undefined) return over
    return morph?.color ?? null
  }

  const applyMorphColor = () => {
    if (!morphEl) return
    const value = morphColor()
    if (value) morphEl.element.style.setProperty('--mc-morph-color', value)
    else morphEl.element.style.removeProperty('--mc-morph-color')
  }

  const applyStyle = () => {
    const p = paint()
    el.style.setProperty('--mc-size', toCssLength(opts.size))
    el.style.setProperty('--mc-scale', String(p.scale))
    el.style.setProperty('--mc-item-scale', String(p.itemScale))
    el.style.setProperty('--mc-pin-scale', String(p.pinScale))
    el.style.setProperty('--mc-color', p.color)
    el.style.setProperty('--mc-item-color', p.itemColor)
    el.style.setProperty('--mc-blur', toCssLength(p.blur))
    el.style.setProperty('--mc-blend', p.blendMode)
    el.style.setProperty('--mc-z-index', String(opts.zIndex))
    sizePx = resolveLength(opts.size, container)
  }

  const modifier = (name: string) => `${opts.className}--${name}`

  /**
   * Take or release the document level cursor-hiding class.
   *
   * The claim is tracked rather than re-derived at teardown, so the class that
   * gets released is always the one that was taken — even when `className` or
   * `hideNativeCursor` changed in between.
   */
  const syncHideNative = () => {
    // Gated on `seen`: hiding the native cursor before the custom one can be
    // placed would leave the page with no cursor at all.
    // Morph mode owns the pointer interaction. Once its shape has landed on a
    // target, hide the OS cursor by default so the merged border/fill is the
    // single visible cursor. `showNativeCursor: true` is an explicit opt-out.
    const yieldToNative = merged && morph?.showNativeCursor === true
    const wanted =
      !destroyed &&
      seen &&
      ((opts.hideNativeCursor && !yieldToNative) || (merged && !yieldToNative))
        ? `${opts.className}-hide-native`
        : null
    if (wanted === hideNativeClass) return

    if (hideNativeClass) {
      const remaining = (hideNativeUsers.get(hideNativeClass) ?? 1) - 1
      if (remaining <= 0) {
        hideNativeUsers.delete(hideNativeClass)
        root.classList.remove(hideNativeClass)
      } else {
        hideNativeUsers.set(hideNativeClass, remaining)
      }
    }

    hideNativeClass = wanted
    if (wanted) {
      hideNativeUsers.set(wanted, (hideNativeUsers.get(wanted) ?? 0) + 1)
      root.classList.add(wanted)
    }
  }

  const element = (name: string) => `${opts.className}__${name}`

  /**
   * Rebuild the morph layer to match the options.
   *
   * It sits under the liquid body rather than inside it: the goo filter would
   * erase a border ring, and the merge reads just as well with the ring painted
   * cleanly beneath the disc that is stretching into it.
   */
  const buildMorph = () => {
    morphEl?.destroy()
    morphEl = null
    morph = resolveMorph(opts.morph)
    if (morph) {
      morphEl = createMorph(element('morph'), morph)
      applyMorphColor()
      el.insertBefore(morphEl.element, bodyEl)
    }
    syncClasses()
  }

  /**
   * The underline layer, a second sibling of the liquid body.
   *
   * Outside the goo filter for the reason the merge layer is: the filter
   * erases anything thinner than roughly `1.13 * goo`, and a rule is thinner
   * than the 2px ring it already deleted once.
   */
  const buildUnderline = () => {
    underlineEl?.destroy()
    underlineEl = null
    underlineTarget = null
    underline = resolveUnderline(opts.underline)
    if (underline) {
      underlineEl = createUnderline(element('underline'), underline)
      el.insertBefore(underlineEl.element, bodyEl)
    }
    syncClasses()
  }

  /** Rebuild the class list from state so a renamed base class keeps its modifiers. */
  const syncClasses = () => {
    el.className = opts.className
    bodyEl.className = element('body')
    headEl.className = element('head')
    if (morphEl) morphEl.element.className = element('morph')
    if (underlineEl) underlineEl.element.className = element('underline')
    for (const drop of drops) drop.el.className = element('drop')
    el.classList.toggle(modifier('trail'), trail !== null)
    el.classList.toggle(modifier('morph'), morph !== null)
    el.classList.toggle(modifier('underline'), underline !== null)
    el.classList.toggle(modifier('morph-border'), (morphEl?.mode ?? morph?.mode) === 'border')
    // `merged` is state like the rest: rebuilding the list without it would
    // drop it whenever the merge target changes.
    el.classList.toggle(modifier('merged'), merged)
    // Held from the moment a target is taken, where `merged` waits until the
    // merge is half done — see the toggle in the frame loop.
    el.classList.toggle(modifier('merging'), morphEl?.attached === true)
    el.classList.toggle(modifier('item'), isItem)
    el.classList.toggle(modifier('pinned'), isPinned)
    el.classList.toggle(modifier('hidden'), isHidden)
  }

  const writeFrame = (
    x: number,
    y: number,
    angle: number,
    scaleX: number,
    scaleY: number,
    tail: number,
  ) => {
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`
    headEl.style.transform = `rotate(${angle}deg) scale(${scaleX}, ${scaleY})`

    // The head is rotated onto its direction of travel, so the trailing edge is
    // always the left pair of corners. Quantised to `TAIL_STEP` so the property
    // — and the paint it costs — only changes when the shape visibly does.
    if (tail === lastTail) return
    lastTail = tail
    el.style.setProperty(
      '--mc-radius',
      tail === 50 ? CIRCLE : `${tail}% 50% 50% ${tail}% / 50% 50% 50% 50%`,
    )
  }

  /**
   * Rebuild the trail to match the current options.
   *
   * The goo filter is what turns the drops into one liquid body: blur their
   * alpha, then push it back through a steep ramp so overlapping drops fuse
   * with a shoulder between them. It has to be an SVG filter — the CSS
   * `blur() contrast()` version of this trick needs an opaque backdrop, and the
   * cursor layer is transparent.
   */
  const buildTrail = () => {
    for (const drop of drops) drop.el.remove()
    drops = []
    gooSvg?.remove()
    gooSvg = null
    gooAlphaEl = null

    if (!trail) {
      bodyEl.style.removeProperty('--mc-trail-box')
      bodyEl.style.removeProperty('filter')
      return
    }

    trailUid += 1
    const filterId = `mc-goo-${trailUid}`

    gooSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    gooSvg.setAttribute('aria-hidden', 'true')
    gooSvg.setAttribute('width', '0')
    gooSvg.setAttribute('height', '0')
    gooSvg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'
    // The default filter region is the bounding box plus 10%, which clips the
    // blur exactly where the drops need to reach each other.
    // The goo threshold erases anything fainter than ~0.47 alpha, which is most
    // cursors on a light page. So the shapes are flattened into an opaque
    // silhouette first, merged, and then faded back to the alpha they were
    // actually drawn with — the merge maths never sees the transparency.
    const alpha = resolveAlpha(paint().color, container)
    gooSvg.innerHTML = `<defs><filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
<feColorMatrix in="SourceGraphic" type="matrix" values="${KEEP_RGB}  0 0 0 ${SOLID_ALPHA} 0" result="solid"/>
<feGaussianBlur in="solid" stdDeviation="${trail.goo}" result="blur"/>
<feColorMatrix in="blur" type="matrix" values="${KEEP_RGB}  0 0 0 19 -9" result="goo"/>
<feColorMatrix in="goo" type="matrix" values="${KEEP_RGB}  0 0 0 ${alpha} 0"/>
</filter></defs>`
    container.appendChild(gooSvg)
    gooAlphaEl = gooSvg.querySelector('feColorMatrix:last-of-type')

    for (let i = 0; i < trail.count; i += 1) {
      const node = document.createElement('div')
      node.className = element('drop')
      // Each drop chases the pointer on its own, lazier time constant; the
      // spread between them is what strings them out into a queue.
      const scale = 1 - ((i + 1) / (trail.count + 1)) * trail.taper
      // The loop may not run before the next paint, so the resting pose has to
      // be on the element already — otherwise the drops flash at full size.
      node.style.transform = `translate(0px, 0px) scale(${scale})`
      drops.push({
        el: node,
        tau: followTau * (1 + (i + 1) * trail.spread),
        scale,
        x: cursorX,
        y: cursorY,
      })
      bodyEl.appendChild(node)
    }

    bodyEl.style.setProperty('--mc-trail-box', `${trail.box}px`)
    bodyEl.style.filter = `url(#${filterId})`
  }

  /**
   * Re-read the fill's alpha into the filter's last stage.
   *
   * Cheaper than rebuilding the trail for a colour change, and it leaves the
   * drops where they are — a rebuild would snap them back onto the head, which
   * is very visible while dragging an opacity slider.
   */
  const syncGooAlpha = () => {
    if (!gooAlphaEl) return
    gooAlphaEl.setAttribute(
      'values',
      `${KEEP_RGB}  0 0 0 ${resolveAlpha(paint().color, container)} 0`,
    )
  }

  /** Re-pitch the queue after `lerp` moved, without tearing the drops down. */
  const syncTrailTiming = () => {
    const spread = trail?.spread
    if (spread === undefined) return
    drops.forEach((drop, i) => {
      drop.tau = followTau * (1 + (i + 1) * spread)
    })
  }

  /** Advance the drops and write them, returning whether any is still moving. */
  const stepTrail = (dt: number): boolean => {
    if (!trail || drops.length === 0) return false

    const limit = trail.box / 2
    let moving = false

    for (const drop of drops) {
      drop.x += (mouseX - drop.x) * (1 - Math.exp(-dt / drop.tau))
      drop.y += (mouseY - drop.y) * (1 - Math.exp(-dt / drop.tau))

      // Offsets are relative to the head, and have to stay inside the filtered
      // box or the drop is simply not drawn.
      //
      // 2D `translate`, never `translate3d`. A drop that asks for its own
      // compositing layer is filtered on its own in Safari, rather than with
      // the rest of the body — the drops then threshold separately and never
      // fuse, which is the entire point of the goo. Measured in Safari: either
      // `translate3d` or `will-change: transform` on a drop is enough to break
      // it, and neither shows up in a headless engine. See the Safari notes in
      // development/safari-compat.md (maintainer notes, not published).
      const dx = clamp(drop.x - cursorX, -limit, limit)
      const dy = clamp(drop.y - cursorY, -limit, limit)
      drop.el.style.transform = `translate(${dx}px, ${dy}px) scale(${drop.scale})`

      if (Math.abs(mouseX - drop.x) > opts.threshold || Math.abs(mouseY - drop.y) > opts.threshold)
        moving = true
    }

    return moving
  }

  /** Whether the loop is allowed to run right now. */
  const canRun = () => !destroyed && !paused && !(opts.pauseOnHidden && hidden)

  const render = (time: number) => {
    frameId = 0
    if (!canRun()) {
      lastTime = 0
      return
    }

    const elapsed = (time - lastTime) / 1000
    const dt = lastTime === 0 || elapsed <= 0 ? NOMINAL_FRAME : Math.min(MAX_FRAME, elapsed)
    lastTime = time

    // Exponential smoothing over elapsed time rather than over frames, so the
    // follow is identical at 60Hz and 120Hz.
    const k = followTau === 0 ? 1 : 1 - Math.exp(-dt / followTau)
    const dx = (mouseX - cursorX) * k
    const dy = (mouseY - cursorY) * k
    cursorX += dx
    cursorY += dy

    const speed = Math.sqrt(dx * dx + dy * dy) / dt
    still = speed > 1 ? 0 : still + dt

    let scaleX = 1
    let scaleY = 1
    let tail = 50

    if (liquid?.enabled) {
      // Area preserving squash: the faster the cursor travels, the longer and
      // thinner it gets along its direction of travel. The target is low passed
      // rather than applied directly, so the shape lags the pointer and eases
      // back — that lag is the difference between a liquid and a rubber band.
      const want = clamp(1 + speed / liquid.divisor, 1, liquid.max)
      factor += (want - factor) * (1 - Math.exp(-dt / liquid.settle))

      scaleX = factor
      scaleY = 2 - factor

      // ...and the trailing corners collapse into a point, so the blob reads
      // as a liquid being dragged rather than a rigid ellipse.
      const amount = liquid.max > 1 ? (factor - 1) / (liquid.max - 1) : 0
      tail = 50 - Math.round((amount * liquid.tail * 50) / TAIL_STEP) * TAIL_STEP
    } else {
      factor = 1
    }

    // Direction is meaningless at a standstill, and `atan2` of a sub-pixel step
    // is mostly noise; freezing it keeps the tail from swinging around.
    if (speed > (liquid?.angleFloor ?? 0)) lastAngle = (Math.atan2(dy, dx) * 180) / Math.PI

    writeFrame(cursorX, cursorY, lastAngle, scaleX, scaleY, tail)
    const trailMoving = stepTrail(dt)

    /*
     * A target that has left the document is let go here, because nothing else
     * will let it go.
     *
     * Both layers are told about their element by `mouseover` alone, so an
     * element removed while the pointer is still on it — a modal closing, a
     * list item deleted, a route swapped under a motionless pointer — is never
     * handed back. The merge then holds a detached subtree, measures it every
     * frame, and keeps the loop awake doing it. Worse than the retention: the
     * layer paints the zero box a detached node reports while `--merged` still
     * hides the disc, the trail and the OS cursor, so the screen has no cursor
     * on it at all until the pointer happens to move.
     *
     * Released through `attach(null)` rather than by clearing the layer's own
     * target, so this is an ordinary separation: the shape withdraws over
     * `duration` and the loop sleeps when it is done.
     */
    if (morphEl && morphTarget && !morphTarget.isConnected) {
      morphTarget = null
      morphEl.attach(null)
    }
    if (underlineEl && underlineTarget && !underlineTarget.isConnected) {
      underlineTarget = null
      underlineEl.attach(null)
    }

    // The merged shape is driven from the pointer rather than the eased cursor,
    // so it lands on the element the pointer is actually over.
    //
    // Its coordinates start at the root's own translated position. The root
    // carries `will-change: transform`, which makes it the containing block for
    // the `position: fixed` merge layer, and it is a plain point: the trail's
    // box and the negative margins that centre it live on the body, so nothing
    // else shifts the origin.
    const morphMoving = morphEl
      ? morphEl.step(
          dt,
          mouseX,
          mouseY,
          sizePx * (morphEl.mode === 'fill' ? opts.scale : opts.itemScale),
          still,
          cursorX,
          cursorY,
        )
      : false
    // Fill is one visual handoff: the morph reveals from the entry point while
    // the ordinary cursor fades on exactly the same progress value.
    el.style.setProperty('--mc-fill-amount', String(morphEl?.fillAmount ?? 0))
    // Same origin as the merge layer, and for the same reason: both are
    // `position: fixed` inside a root that is their containing block.
    const underlineMoving = underlineEl ? underlineEl.step(dt, cursorX, cursorY) : false
    /*
     * The mode now outlives its target — a trace finishes as a trace — so the
     * class it paints from has to be dropped by the frame that lets it go,
     * not by the mouseover that started the release.
     */
    const morphModeNow = morphEl?.mode
    if (morphModeNow !== morphMode) {
      morphMode = morphModeNow
      el.classList.toggle(modifier('morph-border'), morphModeNow === 'border')
    }

    const mergedNow = (morphEl?.amount ?? 0) > 0.5
    if (mergedNow !== merged) {
      merged = mergedNow
      el.classList.toggle(modifier('merged'), merged)
      syncHideNative()
    }

    /*
     * `merging` is taken the instant a target is, while `merged` waits for the
     * merge to be half done.
     *
     * The gap between them is what the disc used to spend growing into its
     * hover size before being told to disappear — a balloon and then a vanish,
     * on an element that was always going to be traced instead. The stylesheet
     * uses this to leave the disc alone for a merge it can see coming.
     */
    const mergingNow = morphEl?.attached === true
    if (mergingNow !== merging) {
      merging = mergingNow
      el.classList.toggle(modifier('merging'), merging)
    }

    const restX = mouseX - cursorX
    const restY = mouseY - cursorY
    const arrived = restX * restX + restY * restY <= opts.threshold * opts.threshold

    // Position, shape, every trailing drop, the merge and the underline all
    // have to be done. A merge also holds the loop open on purpose: the element
    // underneath can move, and the idle nudge needs a heartbeat. So does a drawn
    // underline, for the same reason — the element it sits under can move.
    if (arrived && factor - 1 <= RELAXED && !trailMoving && !morphMoving && !underlineMoving) {
      cursorX = mouseX
      cursorY = mouseY
      factor = 1
      lastTime = 0
      for (const drop of drops) {
        drop.x = mouseX
        drop.y = mouseY
      }
      writeFrame(cursorX, cursorY, lastAngle, 1, 1, 50)
      stepTrail(dt)
      return
    }

    frameId = requestAnimationFrame(render)
  }

  /** Wake the loop if it is idle and allowed to run. */
  const schedule = () => {
    if (frameId !== 0 || !canRun()) return
    // Anchor the clock now so the first frame after a wake integrates its real
    // elapsed time instead of a guess.
    if (lastTime === 0) lastTime = performance.now()
    frameId = requestAnimationFrame(render)
  }

  const cancel = () => {
    lastTime = 0
    if (frameId === 0) return
    cancelAnimationFrame(frameId)
    frameId = 0
  }

  /**
   * Take a pointer reading, revealing the cursor the first time one arrives.
   *
   * A fresh reading after the pointer has been away is landed on rather than
   * eased toward: the cursor is hidden in between, so easing would only produce
   * a streak from wherever it used to be.
   */
  const adopt = (x: number, y: number) => {
    mouseX = x
    mouseY = y

    still = 0
    if (needsSnap) {
      needsSnap = false
      cursorX = x
      cursorY = y
      for (const drop of drops) {
        drop.x = x
        drop.y = y
      }
      writeFrame(x, y, lastAngle, 1, 1, 50)
    }

    if (!seen) {
      seen = true
      syncHideNative()
    }

    if (isHidden) {
      isHidden = false
      el.classList.remove(modifier('hidden'))
    }
  }

  const onMouseMove = (event: MouseEvent) => {
    adopt(event.clientX, event.clientY)
    schedule()
  }

  const onMouseEnter = (event: MouseEvent) => {
    adopt(event.clientX, event.clientY)
    schedule()
  }

  const onMouseLeave = () => {
    isHidden = true
    needsSnap = true
    el.classList.add(modifier('hidden'))
    /*
     * Hover state is dropped with the pointer.
     *
     * Leaving the window fires `mouseout`, never a last `mouseover` — so an
     * `isItem` taken on the element the pointer left through is never handed
     * back, and a pointer that shoots off the top edge from a nav link left
     * `--item` on the root for good. That class outranks `--hidden` in the
     * stylesheet, so the small disc stayed painted at the edge of the screen.
     */
    if (isItem) {
      isItem = false
      el.classList.remove(modifier('item'))
      opts.onItemChange?.(false, null)
    }
    if (isPinned) {
      isPinned = false
      el.classList.remove(modifier('pinned'))
    }
    if (colorOverride !== null) {
      colorOverride = null
      el.style.removeProperty('--mc-override-color')
    }
    if (morphEl && morphTarget) {
      morphTarget = null
      morphEl.attach(null)
      schedule()
    }
    if (underlineEl && underlineTarget) {
      underlineTarget = null
      underlineEl.attach(null)
      schedule()
    }
  }

  const onMouseOver = (event: MouseEvent) => {
    const target = event.target as Element | null
    if (!target || typeof target.closest !== 'function') return

    if (morph && morphEl) {
      const next = target.closest(morph.matchSelector)
      if (next !== morphTarget) {
        morphTarget = next
        morphEl.attach(next)
        // The element may have asked for a different mode than the default.
        syncClasses()
        schedule()
      }
    }

    if (underline && underlineEl) {
      // An element that merges is not also underlined: the merge turns the
      // cursor into the element, and a rule beneath it as well would be two
      // claims at once. `morphTarget` is set just above, so this reads the
      // decision rather than repeating it.
      const next = morphTarget ? null : target.closest(underline.matchSelector)
      if (next !== underlineTarget) {
        underlineTarget = next
        underlineEl.attach(next)
        schedule()
      }
    }

    const item = target.closest(opts.itemSelector)
    const nextIsItem = item !== null
    if (nextIsItem !== isItem) {
      isItem = nextIsItem
      el.classList.toggle(modifier('item'), isItem)
      opts.onItemChange?.(isItem, item)
    }

    const colored = target.closest(`[${opts.colorAttribute}]`)
    const nextColor = colored?.getAttribute(opts.colorAttribute) || null
    if (nextColor !== colorOverride) {
      colorOverride = nextColor
      if (colorOverride === null) el.style.removeProperty('--mc-override-color')
      else el.style.setProperty('--mc-override-color', colorOverride)
    }

    const nextIsPinned = opts.pinSelector ? target.closest(opts.pinSelector) !== null : false
    if (nextIsPinned !== isPinned) {
      isPinned = nextIsPinned
      el.classList.toggle(modifier('pinned'), isPinned)
    }
  }

  const onVisibilityChange = () => {
    hidden = document.hidden
    if (canRun()) schedule()
    else cancel()
  }

  /** Repaint on a theme flip. Nothing is rebuilt: the DOM is identical. */
  const repaint = () => {
    applyStyle()
    applyMorphColor()
    syncGooAlpha()
  }

  themeWatcher = createThemeWatcher({
    mode: opts.theme,
    darkSelector: opts.darkSelector,
    lightSelector: opts.lightSelector,
    themeRoot: opts.themeRoot,
    onChange: (next) => {
      theme = next
      repaint()
    },
  })
  theme = themeWatcher.theme

  applyStyle()
  syncClasses()
  writeFrame(cursorX, cursorY, 0, 1, 1, 50)
  container.appendChild(el)
  // After the append: the trail's filter reads the head's rendered alpha, and
  // `size` resolves to px, only once the element is in the document.
  applyStyle()
  buildMorph()
  buildUnderline()
  buildTrail()

  mountedCursors += 1
  root.setAttribute('data-magnet-cursor', 'enabled')

  syncHideNative()

  document.addEventListener('mousemove', onMouseMove, { passive: true })
  document.addEventListener('mouseenter', onMouseEnter)
  document.addEventListener('mouseleave', onMouseLeave)
  document.addEventListener('mouseover', onMouseOver, { passive: true })
  document.addEventListener('visibilitychange', onVisibilityChange)

  // Deliberately no initial frame: the cursor stays hidden until `adopt` gets a
  // real pointer position, then starts from there.

  return {
    get element() {
      return destroyed ? null : el
    },
    enabled: true,
    setOptions(next) {
      const prevClassName = opts.className
      const prevTrail = trail
      opts = { ...opts, ...next }

      // Styles first. The trail's filter reads the fill's *rendered* alpha, so
      // it has to see the new colour, not the one being replaced.
      if (opts.className !== prevClassName) syncClasses()

      // The watcher owns `theme`, so it is refreshed before anything paints.
      if (
        'theme' in next ||
        'darkSelector' in next ||
        'lightSelector' in next ||
        'themeRoot' in next
      ) {
        themeWatcher?.update({
          mode: opts.theme,
          darkSelector: opts.darkSelector,
          lightSelector: opts.lightSelector,
          themeRoot: opts.themeRoot,
        })
        if (themeWatcher) theme = themeWatcher.theme
      }

      applyStyle()
      applyMorphColor()
      syncHideNative()

      if ('liquid' in next) liquid = resolveLiquid(opts.liquid)
      if ('lerp' in next) followTau = resolveFollowTau(opts.lerp)
      const nextMorph = resolveMorph(opts.morph)
      if (sameMorph(morph, nextMorph)) {
        // Same layer: update in place so the element being merged with is kept.
        morph = nextMorph
        morphEl?.setOptions(nextMorph)
        applyMorphColor()
      } else {
        buildMorph()
        morphTarget = null
        schedule()
      }

      const nextUnderline = resolveUnderline(opts.underline)
      if (sameUnderline(underline, nextUnderline)) {
        underline = nextUnderline
        underlineEl?.setOptions(nextUnderline)
      } else {
        buildUnderline()
        schedule()
      }

      trail = resolveTrail(opts.trail)
      if (sameTrail(prevTrail, trail)) {
        // Options are usually handed over as a whole object, so `trail` is
        // present on nearly every call. Rebuilding on presence rather than on
        // change would snap the drops back onto the head every time anything
        // moved.
        syncTrailTiming()
        syncGooAlpha()
      } else {
        buildTrail()
        syncClasses()
        schedule()
      }
    },
    pause() {
      paused = true
      cancel()
    },
    resume() {
      paused = false
      schedule()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      cancel()
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseenter', onMouseEnter)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('mouseover', onMouseOver)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      themeWatcher?.destroy()
      themeWatcher = null

      mountedCursors -= 1
      if (mountedCursors === 0) root.removeAttribute('data-magnet-cursor')
      syncHideNative()

      gooSvg?.remove()
      morphEl?.destroy()
      underlineEl?.destroy()
      el.remove()
    },
  }
}
