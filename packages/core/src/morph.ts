import { readScreenBox } from './geometry'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Periodic attention nudge, so a merged cursor never becomes impossible to find. */
export interface MagnetCursorIdleOptions {
  /** Seconds of stillness before the first nudge. Default `1.6`. */
  after?: number
  /** Seconds between nudges. Default `3`. */
  every?: number
  /** Seconds one nudge lasts. Default `0.7`. */
  duration?: number
  /** Nudge strength, 0..1. Default `1`. */
  strength?: number
}

/**
 * Merging the cursor into whatever it is pointing at.
 *
 * Instead of floating over an interactive element, the cursor takes the
 * element's own geometry — either filling it as a hover background, or tracing
 * its border. Both are the same mechanism with different paint.
 */
export interface MagnetCursorMorphOptions {
  /**
   * An extra region to merge with, for markup you cannot annotate — a
   * third-party widget, say. Purely additive: elements carrying
   * `modeAttribute` always merge, and nothing here can take that away.
   * Elements matched this way take `mode`, and can still refuse with
   * `modeAttribute="none"`. Default `null` — only annotated elements merge.
   */
  include?: string | null
  /** Fill the element, or trace its border. Default `'fill'`. */
  mode?: 'fill' | 'border'
  /**
   * Attribute an element can carry to pick its own mode — `'fill'`, `'border'`
   * or `'none'` to refuse the merge. Carrying it at all is what opts the
   * element in; carrying it with no value (or an unknown one) merges with
   * `mode`. Default `'data-magnet-cursor-morph'`.
   */
  modeAttribute?: string
  /** Seconds the merge and the separation take. Default `0.22`. */
  duration?: number
  /** Extra px around the element's box. Default `0`. */
  padding?: number
  /** Ring thickness in `'border'` mode, px. Default `2`. */
  borderWidth?: number
  /** Corner radius in px, or `null` to copy the element's own. Default `null`. */
  radius?: number | null
  /** Fill or ring colour, or `null` to use the cursor's `itemColor`. Default `null`. */
  color?: string | null
  /** How far the pointer still drags the merged shape, 0..1. Default `0.06`. */
  drift?: number
  /**
   * Keep the OS cursor visible while merged. Set this to `true` as an explicit
   * opt-out when the native cursor should remain available. Default `false`.
   */
  showNativeCursor?: boolean
  /** Attention nudge while merged, or `false` to never nudge. */
  idle?: MagnetCursorIdleOptions | false
}

export type ResolvedMorph = Required<Omit<MagnetCursorMorphOptions, 'idle'>> & {
  idle: Required<MagnetCursorIdleOptions> | null
  /**
   * What `mouseover` actually matches against: the mode attribute, plus
   * `include` when one is given. Derived rather than configured, so the
   * attribute can never be selected away.
   */
  matchSelector: string
}

const idleDefaults: Required<MagnetCursorIdleOptions> = {
  after: 1.6,
  every: 3,
  duration: 0.7,
  strength: 1,
}

const morphDefaults: Omit<ResolvedMorph, 'idle' | 'matchSelector'> = {
  include: null,
  mode: 'fill',
  modeAttribute: 'data-magnet-cursor-morph',
  duration: 0.22,
  padding: 0,
  borderWidth: 2,
  radius: null,
  color: null,
  drift: 0.06,
  showNativeCursor: false,
}

/**
 * The merge is opt-in: an element joins by carrying the mode attribute.
 *
 * `include` only ever widens that set. Letting it narrow the set — the shape a
 * plain `selector` option would have — means a region written in one place can
 * silently void an attribute written in another, which is a failure with no
 * error and nothing painted. Our own site shipped five such elements.
 */
export const resolveMorph = (
  morph: MagnetCursorMorphOptions | false | undefined,
): ResolvedMorph | null => {
  if (morph === undefined || morph === false) return null
  const { idle, ...rest } = morph
  const resolved = {
    ...morphDefaults,
    ...rest,
    idle: idle === false ? null : { ...idleDefaults, ...idle },
  }
  const attr = `[${resolved.modeAttribute}]`
  return {
    ...resolved,
    matchSelector: resolved.include ? `${attr}, ${resolved.include}` : attr,
  }
}

/**
 * Whether two resolved morphs describe the same layer.
 *
 * Options are usually handed over as a whole object, so `morph` is present on
 * nearly every call. Rebuilding on presence rather than on change would drop
 * the element the cursor is currently merged with — and one of the things that
 * triggers a re-render is the item state changing, which is exactly the moment
 * the merge begins.
 */
export const sameMorph = (a: ResolvedMorph | null, b: ResolvedMorph | null): boolean => {
  if (a === null || b === null) return a === b
  const idleSame =
    a.idle === null || b.idle === null
      ? a.idle === b.idle
      : a.idle.after === b.idle.after &&
        a.idle.every === b.idle.every &&
        a.idle.duration === b.idle.duration &&
        a.idle.strength === b.idle.strength
  return (
    idleSame &&
    a.matchSelector === b.matchSelector &&
    a.mode === b.mode &&
    a.modeAttribute === b.modeAttribute &&
    a.duration === b.duration &&
    a.padding === b.padding &&
    a.borderWidth === b.borderWidth &&
    a.radius === b.radius &&
    a.color === b.color &&
    a.drift === b.drift &&
    a.showNativeCursor === b.showNativeCursor
  )
}

/**
 * The merge's own easing, over `duration` seconds in either direction.
 *
 * Fast out of the gate and soft into the end, which is what a merge landing on
 * an element wants — and, reversed, what its release wants too. The same curve
 * a CSS `transition: … ease-out` would run, for the same reason: `duration` is
 * documented as the time the merge and the separation take, so it has to be a
 * time and not a rate.
 */
const easeOut = (progress: number): number => 1 - (1 - progress) ** 3

interface Box {
  x: number
  y: number
  width: number
  height: number
  /**
   * Eight numbers: a horizontal and a vertical radius for each corner, in px,
   * clockwise from the top left — the same shape CSS itself carries.
   *
   * One number cannot describe a circle. `border-radius: 50%` is a percentage
   * of each axis, so on a 180x90 box it means 90px across and 45px down; and a
   * `getComputedStyle` read gives back the literal `'50%'`, which parses as the
   * number 50 and quietly draws a rounded rectangle instead. Corners can also
   * differ from each other, and each can be elliptical.
   */
  radii: Radii
  /** The element's own rotation in degrees, so the merge can match it. */
  rotation: number
}

/** `[h0, h1, h2, h3, v0, v1, v2, v3]`, clockwise from the top left. */
type Radii = [number, number, number, number, number, number, number, number]

const CORNERS = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
] as const

/** One radius token — `12px` or `50%` — against the axis it is measured on. */
const resolveRadius = (token: string | undefined, basis: number): number => {
  if (!token) return 0
  const value = Number.parseFloat(token)
  if (!Number.isFinite(value)) return 0
  return token.endsWith('%') ? (value / 100) * basis : value
}

/**
 * The element's corners, resolved to px.
 *
 * A computed corner is either one token (`12px`, `50%`) or two, the horizontal
 * radius then the vertical one — which is how an elliptical corner is written.
 */
const readRadii = (style: CSSStyleDeclaration, width: number, height: number): Radii => {
  const h: number[] = []
  const v: number[] = []
  for (const corner of CORNERS) {
    const tokens = String(style[corner] ?? '')
      .trim()
      .split(/\s+/)
    h.push(resolveRadius(tokens[0], width))
    v.push(resolveRadius(tokens[1] ?? tokens[0], height))
  }
  return [...h, ...v] as Radii
}

export type MorphMode = 'fill' | 'border'

export interface MorphInstance {
  readonly element: HTMLElement
  /** Merge with `target`, or pull back out when it is `null`. */
  attach: (target: Element | null) => void
  /** The mode the current (or last) target asked for. */
  readonly mode: MorphMode
  /** Whether a target is currently held. */
  readonly attached: boolean
  /** How merged the cursor is, 0..1. */
  readonly amount: number
  /** Progress of a fill reveal. `0` for border mode. */
  readonly fillAmount: number
  /**
   * Advance one frame and paint.
   *
   * `still` is the seconds the pointer has been motionless, which is what
   * drives the nudge. `originX/Y` is where the layer's containing block sits in
   * the viewport: the layer lives inside the cursor root, which carries
   * `will-change: transform` and is therefore its containing block even though
   * the layer is `position: fixed` — so everything painted here has to be
   * measured from there. Returns whether anything is still in motion.
   */
  step: (
    dt: number,
    pointerX: number,
    pointerY: number,
    discSize: number,
    still: number,
    originX: number,
    originY: number,
  ) => boolean
  setOptions: (next: ResolvedMorph | null) => void
  destroy: () => void
}

/**
 * Create the element the cursor merges into.
 *
 * It lives in the cursor's root but outside the liquid body, so it shares the
 * root's blend mode and modifier classes without going through the goo filter —
 * that filter thresholds alpha, and a border ring is thin enough that it would
 * be erased rather than softened.
 */
export function createMorph(className: string, options: ResolvedMorph | null): MorphInstance {
  const el = document.createElement('div')
  el.className = className

  let opts = options
  let target: Element | null = null
  /** The mode in force, which the attached element may have overridden. */
  let mode: MorphMode = options?.mode ?? 'fill'
  /**
   * How far through `duration` the merge is, 0..1.
   *
   * The state is the time rather than the shape, so that a pointer that leaves
   * and comes back turns the clock around where it stands: `amount` is read off
   * the curve every frame and cannot jump. `amount` itself was the state until
   * it was an exponential approach — which never arrived, so it needed a floor
   * to stop at, and the floor was six time constants out. A fill spent that
   * tail as an opaque dot shrinking in place for the better part of a second.
   */
  let progress = 0
  let amount = 0
  let box: Box | null = null
  let revealX = 0
  let revealY = 0
  let revealAnchored = false

  /**
   * The element's box as the merge has to draw it.
   *
   * `getBoundingClientRect` is the wrong size for anything rotated: it reports
   * the axis-aligned box *around* the rotated shape, which is larger than the
   * element and square to the screen. Tracing that around a tilted pill draws
   * an upright rectangle that touches it at four points and matches it nowhere.
   *
   * So the size comes from layout — `offsetWidth` ignores transforms — scaled
   * by whatever scale the transform carries, and the rotation is handed on for
   * the layer to match. The centre still comes from the rect: rotation and
   * scale about the centre leave it where it was, and any translation is
   * already folded in.
   *
   * The transform is accumulated through the ancestors rather than read off
   * the element alone — see `screenTransform` for why that is not academic.
   */
  const readBox = (node: Element): Box => {
    const style = getComputedStyle(node)
    const pad = opts?.padding ?? 0
    const screen = readScreenBox(node)

    // An explicit `radius` is a plain px number and applies to every corner;
    // otherwise the element's own corners are read, percentages and all.
    const own =
      opts?.radius != null
        ? (Array(8).fill(opts.radius) as Radii)
        : readRadii(style, screen.width / screen.scaleX, screen.height / screen.scaleY)

    // Horizontal radii follow the horizontal scale, vertical the vertical, and
    // padding pushes every corner out by the same amount it pushes the box.
    const radii = own.map((r, i) => r * (i < 4 ? screen.scaleX : screen.scaleY) + pad) as Radii

    return {
      x: screen.x,
      y: screen.y,
      width: screen.width + pad * 2,
      height: screen.height + pad * 2,
      radii,
      rotation: screen.rotation,
    }
  }

  const paint = (
    width: number,
    height: number,
    radii: Radii,
    x: number,
    y: number,
    originX: number,
    originY: number,
    rotation: number,
  ) => {
    el.style.width = `${width}px`
    el.style.height = `${height}px`
    // The `h... / v...` form, so an elliptical corner survives the trip. A box
    // whose corners meet in the middle of a side is what makes a circle.
    const h = radii
      .slice(0, 4)
      .map((r) => `${r}px`)
      .join(' ')
    const v = radii
      .slice(4)
      .map((r) => `${r}px`)
      .join(' ')
    el.style.borderRadius = `${h} / ${v}`
    // Rotation comes after the translation so it turns about the layer's own
    // centre, which the translation has just put on the element's centre.
    const turn = rotation ? ` rotate(${rotation}deg)` : ''
    el.style.transform = `translate3d(${x - width / 2 - originX}px, ${y - height / 2 - originY}px, 0)${turn}`
  }

  const paintFillReveal = (
    pointerX: number,
    pointerY: number,
    width: number,
    height: number,
    x: number,
    y: number,
  ) => {
    if (!box || mode !== 'fill') {
      el.style.removeProperty('clip-path')
      el.style.removeProperty('-webkit-clip-path')
      return
    }

    // The reveal remains fixed to the entry point while it expands. Re-anchoring
    // a partly open circle would expose the old fill around its edge.
    if (!revealAnchored) {
      revealX = pointerX
      revealY = pointerY
      revealAnchored = true
    }

    const localX = clamp(revealX - (x - width / 2), 0, width)
    const localY = clamp(revealY - (y - height / 2), 0, height)
    const radius =
      Math.max(
        Math.hypot(localX, localY),
        Math.hypot(width - localX, localY),
        Math.hypot(localX, height - localY),
        Math.hypot(width - localX, height - localY),
      ) *
        amount +
      1
    const clip = `circle(${radius}px at ${localX}px ${localY}px)`
    el.style.clipPath = clip
    el.style.setProperty('-webkit-clip-path', clip)
  }

  const step: MorphInstance['step'] = (
    dt,
    pointerX,
    pointerY,
    discSize,
    still,
    originX,
    originY,
  ) => {
    if (!opts) {
      if (amount !== 0) {
        progress = 0
        amount = 0
        el.style.opacity = '0'
      }
      return false
    }

    if (target) box = readBox(target)

    const advance = opts.duration > 0 ? dt / opts.duration : 1
    progress = clamp(progress + (target ? advance : -advance), 0, 1)
    amount = easeOut(progress)

    if (amount <= 0 || !box) {
      el.style.opacity = '0'
      /*
       * The release is over, so the mode it was released in can go.
       *
       * Dropping it at detach instead — which is where it used to happen —
       * turned a traced element's exit into a filled one: the border class came
       * off and the fill's reveal came on while the ring was still shrinking.
       * A merge has to leave the way it arrived, so the mode outlives the
       * target and dies with the last frame that painted it.
       */
      if (opts) mode = opts.mode
      return false
    }

    // The nudge only runs once the merge has landed and the pointer has gone
    // quiet — that is exactly when the merged shape stops marking the pointer.
    let pulse = 0
    const idle = opts.idle
    if (idle && amount > 0.99 && still >= idle.after) {
      const cycle = idle.every + idle.duration
      const phase = (still - idle.after) % cycle
      if (phase < idle.duration) {
        pulse = Math.sin((phase / idle.duration) * Math.PI) * idle.strength
      }
    }

    const disc = discSize

    /*
     * A fill is in place from the first frame; only the reveal moves.
     *
     * It used to interpolate its box from the disc as well, so a circle was
     * being stretched into a rounded rectangle underneath a circular clip that
     * was opening at its own pace — two shapes on one `amount`, and what you
     * saw was their intersection. The clip already says everything the merge
     * has to say (paint spreading from where the pointer came in, in the
     * cursor's colour), so the stretch was a second animation carrying no
     * second fact. A border still grows into place: tracing an element's shape
     * is what that mode is, and the growth is how it gets there.
     */
    const filling = mode === 'fill'

    // The pointer keeps a little pull on the merged shape, so it still reads as
    // something being held rather than a box that snapped into place. A fill is
    // the element's background, not something held: pulling it towards the
    // pointer would open a gap along the far edge.
    const driftX = filling ? 0 : (pointerX - box.x) * opts.drift * amount
    const driftY = filling ? 0 : (pointerY - box.y) * opts.drift * amount

    // Both fill and border morphs use the same brief idle swell for feedback.
    const swell = 1 + pulse * 0.06
    const width = (filling ? box.width : disc + (box.width - disc) * amount) * swell
    const height = (filling ? box.height : disc + (box.height - disc) * amount) * swell
    // The disc is a circle, so every corner starts at half its size and each
    // one travels to the element's own — which is what lets a circle land on a
    // circle rather than on a rounded square. A fill takes them outright: its
    // corners are the element's from the start, or the clip would spill past
    // them.
    const radii = (
      filling ? box.radii : box.radii.map((r) => disc / 2 + (r - disc / 2) * amount)
    ) as Radii
    const x = filling ? box.x : pointerX + (box.x - pointerX) * amount + driftX * amount
    const y = filling ? box.y : pointerY + (box.y - pointerY) * amount + driftY * amount

    // Interpolated with the merge: the disc is a circle, so at the start the
    // angle cannot be seen, and the shape turns into place as it takes the
    // element's geometry. A fill is already there, so it is already turned.
    paint(width, height, radii, x, y, originX, originY, box.rotation * (filling ? 1 : amount))
    // Opaque throughout, because the clip decides what is visible. Fading the
    // layer as well would put a second curve on the same event.
    el.style.opacity = filling ? '1' : String(amount)
    paintFillReveal(pointerX, pointerY, width, height, x, y)

    if (mode === 'border') {
      el.style.setProperty('--mc-morph-width', `${opts.borderWidth}px`)
    }

    // Keep running while the merge is in flight, while a target could move
    // under us, or while a nudge is due.
    return amount > 0
  }

  return {
    element: el,
    attach(next) {
      // An element may name its own mode, so a border-traced nav can sit beside
      // a background-filled button under one cursor.
      const asked = next && opts ? next.getAttribute(opts.modeAttribute) : null

      /*
       * Only an element that is actually taking the merge sets the mode.
       *
       * Letting go — of a target, or of one that refuses with `none` — leaves
       * it alone, so the shape on screen finishes in the mode it was drawn in.
       * The stale mode that worried us (a leftover `border` masking the middle
       * out of the next fill) cannot happen: the next element to land resolves
       * the mode here, before it is painted.
       */
      if (asked === 'none' || !next) {
        target = null
        return
      }

      if (asked === 'fill' || asked === 'border') mode = asked
      else if (opts) mode = opts.mode

      target = next
      box = readBox(next)
      revealAnchored = false
    },
    get mode() {
      return mode
    },
    get attached() {
      return target !== null
    },
    get amount() {
      return amount
    },
    get fillAmount() {
      return mode === 'fill' ? amount : 0
    },
    step,
    setOptions(next) {
      opts = next
      if (!next) {
        target = null
        progress = 0
        amount = 0
        el.style.opacity = '0'
      }
    },
    destroy() {
      target = null
      el.remove()
    },
  }
}

/** Exposed for the cursor's own bookkeeping. */
export const morphIsBorder = (morph: ResolvedMorph | null): boolean => morph?.mode === 'border'
