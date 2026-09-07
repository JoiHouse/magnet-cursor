import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMagnetCursor } from '../src/cursor'

/** `size` is numeric so the merge maths is exact; jsdom resolves no CSS lengths. */
const BASE = {
  detectPointer: false,
  respectReducedMotion: false,
  size: 100,
  scale: 0.5,
  itemScale: 0.5,
} as const

let frames = new Map<number, FrameRequestCallback>()
let nextFrameId = 1
let clock = 0
const FRAME_60 = 1000 / 60

const flushFrames = (count = 1) => {
  for (let i = 0; i < count; i += 1) {
    clock += FRAME_60
    const due = [...frames.values()]
    frames.clear()
    for (const cb of due) cb(clock)
  }
}

const pendingFrames = () => frames.size

const move = (clientX: number, clientY: number) =>
  document.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }))

/**
 * jsdom has no layout: a 200x100 target sitting at (100, 100).
 *
 * The merge is opt-in, so a target that means to merge carries the attribute.
 * Bare by default — that alone opts the element in, at whatever `morph.mode`
 * says. Pass `bare: false` for an element that is not supposed to merge.
 */
const mountTarget = ({ bare = true }: { bare?: boolean } = {}) => {
  const el = document.createElement('button')
  if (bare) el.setAttribute('data-magnet-cursor-morph', '')
  el.getBoundingClientRect = () =>
    ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }) as DOMRect
  document.body.appendChild(el)
  return el
}

/** The radius of the fill's reveal, which is the only thing a fill animates. */
const clipRadius = () => {
  const el = document.querySelector<HTMLElement>('.magnet-cursor__morph')!
  return Number.parseFloat(el.style.clipPath.match(/circle\(([\d.]+)px/)?.[1] ?? '0')
}

const hover = (el: Element) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
const unhover = () => document.body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

const shape = () => {
  const el = document.querySelector<HTMLElement>('.magnet-cursor__morph')!
  return {
    width: Math.round(Number.parseFloat(el.style.width)),
    height: Math.round(Number.parseFloat(el.style.height)),
    opacity: Number(el.style.opacity),
  }
}

describe('cursor morph', () => {
  beforeEach(() => {
    frames = new Map()
    nextFrameId = 1
    clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, cb)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-magnet-cursor')
    document.documentElement.className = ''
  })

  it('adds no layer at all when morphing is off', () => {
    const cursor = createMagnetCursor(BASE)

    expect(document.querySelector('.magnet-cursor__morph')).toBeNull()
    expect(cursor.element!.classList.contains('magnet-cursor--morph')).toBe(false)

    cursor.destroy()
  })

  it("takes the element's box at once and opens the fill from the pointer", () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.1, drift: 0 } })
    const target = mountTarget()
    move(200, 150)
    flushFrames(2)

    // Nothing is painted until there is something to merge with.
    const layer = document.querySelector<HTMLElement>('.magnet-cursor__morph')!
    expect(layer.style.width).toBe('')
    expect(layer.style.opacity).toBe('0')

    /*
     * A fill does not deform. The layer is the element's box on the first
     * frame — only the reveal moves, so the box is the thing that must not.
     */
    hover(target)
    flushFrames(1)
    expect(shape()).toMatchObject({ width: 200, height: 100, opacity: 1 })
    const opening = clipRadius()
    expect(opening).toBeGreaterThan(0)
    expect(opening).toBeLessThan(50)

    // ...and the reveal is what grows, until it covers the box.
    flushFrames(40)
    expect(shape()).toMatchObject({ width: 200, height: 100, opacity: 1 })
    expect(clipRadius()).toBeGreaterThan(opening)
    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(true)

    cursor.destroy()
  })

  it('grows a border merge from the disc into the element', () => {
    const cursor = createMagnetCursor({
      ...BASE,
      morph: { mode: 'border', duration: 0.1, drift: 0 },
    })
    const target = mountTarget()
    move(200, 150)
    flushFrames(2)

    // Tracing an element is taking its shape, so this one still deforms.
    hover(target)
    flushFrames(1)
    const midway = shape()
    expect(midway.width).toBeGreaterThan(50)
    expect(midway.width).toBeLessThan(200)

    flushFrames(40)
    expect(shape()).toMatchObject({ width: 200, height: 100, opacity: 1 })

    cursor.destroy()
  })

  it('reveals a fill merge from the pointer and shares its progress with the head', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.1, drift: 0 } })
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(1)

    const layer = document.querySelector<HTMLElement>('.magnet-cursor__morph')!
    expect(layer.style.clipPath).toMatch(/^circle\(/)
    expect(Number(cursor.element!.style.getPropertyValue('--mc-fill-amount'))).toBeGreaterThan(0)

    cursor.destroy()
  })

  /** The `translate3d` a given element is currently sitting at. */
  const translation = (el: HTMLElement) => {
    // Only what is inside the parentheses — `translate3d` itself carries a digit.
    const inside = /translate3d\(([^)]+)\)/.exec(el.style.transform)![1]!
    const [x, y] = inside.split(',').map(Number.parseFloat) as [number, number]
    return { x, y }
  }

  /**
   * Where the merge layer actually lands, in viewport coordinates.
   *
   * The layer is `position: fixed` inside the root, but the root carries
   * `will-change: transform` and is therefore its containing block — so the
   * layer's own translation is relative to the root's.
   */
  const layerTopLeft = () => {
    const layer = translation(document.querySelector<HTMLElement>('.magnet-cursor__morph')!)
    const root = translation(document.querySelector<HTMLElement>('.magnet-cursor')!)
    return { x: root.x + layer.x, y: root.y + layer.y }
  }

  it('lands on the element, not offset by the cursor position', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(30)

    // The element's own top-left. Measuring from the viewport instead puts the
    // shape a whole cursor position away from the thing it is tracing.
    expect(layerTopLeft()).toEqual({ x: 100, y: 100 })

    cursor.destroy()
  })

  /**
   * The trail's box lives on the liquid body, not on the root, so it cannot
   * move the origin the merge layer is painted from. It used to sit on the root
   * with margins that centred it, and the origin was compensated by half of it —
   * a compensation that becomes a `box / 2` error the moment the box moves.
   */
  it.each([320, 640])('lands on the element whatever the trail box is (%i)', (box) => {
    const cursor = createMagnetCursor({
      ...BASE,
      morph: { duration: 0.05, drift: 0 },
      trail: { count: 2, box },
    })
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(30)

    expect(layerTopLeft()).toEqual({ x: 100, y: 100 })

    cursor.destroy()
  })

  it('closes the fill back down when the pointer leaves the element', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.1, drift: 0 } })
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(40)
    expect(shape().width).toBe(200)
    const open = clipRadius()

    /*
     * Out the way it came in: the reveal closes towards its anchor and the
     * layer is hidden once it is shut. The box is not what to assert on — a
     * fill's box is the element's whether it is showing or not.
     */
    unhover()
    flushFrames(4)
    expect(clipRadius()).toBeLessThan(open)

    flushFrames(40)
    expect(shape().opacity).toBe(0)
    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(false)

    cursor.destroy()
  })

  /*
   * `duration` is documented as the seconds the merge and the separation take,
   * and it used to be an exponential rate instead — so a release ran for about
   * six times as long as it claimed. A fill spends that tail as an opaque dot
   * shrinking in place, with the disc held invisible behind it.
   */
  it('finishes the release inside duration', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.2, drift: 0 } })
    const el = cursor.element!
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(40)
    expect(Number(el.style.getPropertyValue('--mc-fill-amount'))).toBe(1)

    unhover()
    // 0.2s is 12 frames at 60Hz. One more for the frame the clock lands on.
    flushFrames(13)
    expect(Number(el.style.getPropertyValue('--mc-fill-amount'))).toBe(0)
    expect(shape().opacity).toBe(0)

    cursor.destroy()
  })

  /*
   * The clock turns around where it stands. Reading the shape off a time makes
   * that free — the exponential approach it replaced had the same property, and
   * losing it would trade one visible flaw for another.
   */
  it('turns a half-finished release around without a jump', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.2, drift: 0 } })
    const el = cursor.element!
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(40)

    unhover()
    flushFrames(6)
    const midway = Number(el.style.getPropertyValue('--mc-fill-amount'))
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(1)

    hover(target)
    const seen = [midway]
    for (let i = 0; i < 6; i += 1) {
      flushFrames(1)
      seen.push(Number(el.style.getPropertyValue('--mc-fill-amount')))
    }

    // Monotonic back up, and no step bigger than a frame's worth of the curve.
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]!)
      expect(seen[i]! - seen[i - 1]!).toBeLessThan(0.2)
    }
    expect(seen[seen.length - 1]).toBeGreaterThan(midway)

    cursor.destroy()
  })

  it('pulls a border merge back to the disc when the pointer leaves', () => {
    const cursor = createMagnetCursor({
      ...BASE,
      morph: { mode: 'border', duration: 0.1, drift: 0 },
    })
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(40)
    expect(shape().width).toBe(200)

    unhover()
    flushFrames(40)
    expect(shape().width).toBe(50)
    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(false)

    cursor.destroy()
  })

  it('gives the OS cursor back while merged, and takes it away again', () => {
    const root = document.documentElement
    const cursor = createMagnetCursor({
      ...BASE,
      hideNativeCursor: true,
      morph: { duration: 0.1, showNativeCursor: true },
    })
    const target = mountTarget()
    move(200, 150)
    flushFrames(2)
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(true)

    // A merged cursor no longer marks the pointer, so the OS one comes back.
    hover(target)
    flushFrames(40)
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(false)

    unhover()
    flushFrames(40)
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(true)

    cursor.destroy()
  })

  it('keeps the OS cursor hidden when told to', () => {
    const root = document.documentElement
    const cursor = createMagnetCursor({
      ...BASE,
      hideNativeCursor: true,
      morph: { duration: 0.1, showNativeCursor: false },
    })
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(40)

    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(true)

    cursor.destroy()
  })

  it.each(['fill', 'border'] as const)(
    'hides the OS cursor by default in %s morph mode',
    (mode) => {
      const root = document.documentElement
      const cursor = createMagnetCursor({
        ...BASE,
        morph: { mode, duration: 0.1 },
      })
      const target = mountTarget()
      move(200, 150)
      flushFrames(2)
      expect(root.classList.contains('magnet-cursor-hide-native')).toBe(false)

      hover(target)
      flushFrames(40)
      expect(root.classList.contains('magnet-cursor-hide-native')).toBe(true)

      unhover()
      flushFrames(40)
      expect(root.classList.contains('magnet-cursor-hide-native')).toBe(false)

      cursor.destroy()
    },
  )

  it('traces the border instead of filling in border mode', () => {
    const cursor = createMagnetCursor({
      ...BASE,
      morph: { mode: 'border', borderWidth: 3, duration: 0.1 },
    })
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(40)

    const el = cursor.element!
    expect(el.classList.contains('magnet-cursor--morph-border')).toBe(true)
    const layer = document.querySelector<HTMLElement>('.magnet-cursor__morph')!
    expect(layer.style.getPropertyValue('--mc-morph-width')).toBe('3px')

    cursor.destroy()
  })

  it('lets an element pick its own mode, so one cursor can do both', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { mode: 'border', duration: 0.05 } })
    const traced = mountTarget()
    const filled = mountTarget()
    filled.setAttribute('data-magnet-cursor-morph', 'fill')
    const root = cursor.element!

    move(200, 150)
    hover(traced)
    flushFrames(20)
    expect(root.classList.contains('magnet-cursor--morph-border')).toBe(true)

    hover(filled)
    flushFrames(20)
    expect(root.classList.contains('magnet-cursor--morph-border')).toBe(false)
    expect(shape().width).toBe(200)
    // Switching targets rebuilds the class list; the merge must survive it.
    expect(root.classList.contains('magnet-cursor--merged')).toBe(true)

    cursor.destroy()
  })

  it('refuses to merge with an element that opts out', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const target = mountTarget()
    target.setAttribute('data-magnet-cursor-morph', 'none')

    move(200, 150)
    hover(target)
    flushFrames(20)

    const layer = document.querySelector<HTMLElement>('.magnet-cursor__morph')!
    expect(layer.style.opacity).toBe('0')
    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(false)

    cursor.destroy()
  })

  /**
   * `getBoundingClientRect` reports the axis-aligned box *around* a rotated
   * element — wider and taller than the element, and square to the screen.
   * Tracing that around a tilted pill draws an upright rectangle that touches
   * it at four points and matches it nowhere. Our own site's menu pills are
   * rotated, which is where this showed up.
   */
  it('takes a rotated element’s own size and angle, not its bounding box', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const target = mountTarget()

    // A 200x100 element turned 30°: layout stays 200x100, but the box around
    // it grows to 223x186.
    Object.defineProperty(target, 'offsetWidth', { value: 200, configurable: true })
    Object.defineProperty(target, 'offsetHeight', { value: 100, configurable: true })
    // The form a browser's `getComputedStyle` actually returns — never the
    // `rotate(30deg)` that was written, always the resolved matrix.
    target.style.transform = 'matrix(0.866025, 0.5, -0.5, 0.866025, 0, 0)'
    target.getBoundingClientRect = () =>
      ({ left: 88, top: 57, width: 223, height: 186, right: 311, bottom: 243 }) as DOMRect

    move(200, 150)
    hover(target)
    flushFrames(30)

    const layer = document.querySelector<HTMLElement>('.magnet-cursor__morph')!
    // The element's own 200x100, not the 223x186 box around it.
    expect(Math.round(Number.parseFloat(layer.style.width))).toBe(200)
    expect(Math.round(Number.parseFloat(layer.style.height))).toBe(100)
    const angle = Number.parseFloat(/rotate\(([-\d.]+)deg\)/.exec(layer.style.transform)![1]!)
    expect(angle).toBeCloseTo(30, 1)

    cursor.destroy()
  })

  /**
   * The case that actually shipped broken.
   *
   * The site's menu pills are laid out upright and turned by the list item that
   * holds them, and a magnet writes a plain `translate3d` onto the pill itself —
   * which overrides the CSS rotation that used to be on it. Reading the pill's
   * own transform reports no rotation at all, while the pill is visibly tilted.
   */
  it('follows a rotation that lives on an ancestor', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })

    const holder = document.createElement('div')
    holder.style.transform = 'matrix(0.994522, -0.104528, 0.104528, 0.994522, 0, 0)'
    document.body.appendChild(holder)

    const target = mountTarget()
    // What a magnet writes: a translation, and no trace of the rotation above.
    target.style.transform = 'matrix(1, 0, 0, 1, 4, 2)'
    Object.defineProperty(target, 'offsetWidth', { value: 208, configurable: true })
    Object.defineProperty(target, 'offsetHeight', { value: 80, configurable: true })
    holder.appendChild(target)

    move(200, 150)
    hover(target)
    flushFrames(30)

    const layer = document.querySelector<HTMLElement>('.magnet-cursor__morph')!
    const angle = Number.parseFloat(/rotate\(([-\d.]+)deg\)/.exec(layer.style.transform)![1]!)
    expect(angle).toBeCloseTo(-6, 1)
    expect(Math.round(Number.parseFloat(layer.style.width))).toBe(208)
    expect(Math.round(Number.parseFloat(layer.style.height))).toBe(80)

    cursor.destroy()
  })

  /** The layer's four corners, as `[h0..h3, v0..v3]` in px. */
  const cornerRadii = () => {
    const value = document.querySelector<HTMLElement>('.magnet-cursor__morph')!.style.borderRadius
    const [h, v] = value.split('/')
    return [...h!.trim().split(/\s+/), ...v!.trim().split(/\s+/)].map(Number.parseFloat)
  }

  /** Give a target a size layout would report and a shape to be read off it. */
  const shapeTarget = (width: number, height: number, corners: Record<string, string>) => {
    const el = mountTarget()
    Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true })
    Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true })
    el.getBoundingClientRect = () =>
      ({ left: 100, top: 100, width, height, right: 100 + width, bottom: 100 + height }) as DOMRect
    Object.assign(el.style, corners)
    return el
  }

  /**
   * `border-radius: 50%` is a percentage of each axis, and a computed read
   * gives back the literal `'50%'`. Parsed as a number that is 50 — which on a
   * 120px circle draws a rounded square that touches it at eight points.
   */
  it('lands a circle on a circle, not on a rounded square', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const target = shapeTarget(120, 120, {
      borderTopLeftRadius: '50%',
      borderTopRightRadius: '50%',
      borderBottomRightRadius: '50%',
      borderBottomLeftRadius: '50%',
    })

    move(200, 150)
    hover(target)
    flushFrames(40)

    // Half of each axis on every corner is exactly what makes a circle.
    expect(cornerRadii()).toEqual([60, 60, 60, 60, 60, 60, 60, 60])

    cursor.destroy()
  })

  /** The same percentage on an oblong is an ellipse, and the two axes differ. */
  it('keeps an ellipse elliptical', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const target = shapeTarget(180, 90, {
      borderTopLeftRadius: '50%',
      borderTopRightRadius: '50%',
      borderBottomRightRadius: '50%',
      borderBottomLeftRadius: '50%',
    })

    move(200, 150)
    hover(target)
    flushFrames(40)

    expect(cornerRadii()).toEqual([90, 90, 90, 90, 45, 45, 45, 45])

    cursor.destroy()
  })

  /** Corners need not match each other; reading only the first loses the rest. */
  it('keeps corners that differ from one another', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const target = shapeTarget(120, 120, {
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '48px',
      borderBottomRightRadius: '8px',
      borderBottomLeftRadius: '48px',
    })

    move(200, 150)
    hover(target)
    flushFrames(40)

    expect(cornerRadii()).toEqual([8, 48, 8, 48, 8, 48, 8, 48])

    cursor.destroy()
  })

  /** An unrotated element must be left exactly where it was. */
  it('writes no rotation for an element that has none', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const target = mountTarget()

    move(200, 150)
    hover(target)
    flushFrames(30)

    const layer = document.querySelector<HTMLElement>('.magnet-cursor__morph')!
    expect(layer.style.transform).not.toContain('rotate')
    expect(shape().width).toBe(200)

    cursor.destroy()
  })

  /**
   * The merge repaints an element's background, which is intrusive enough that
   * it does not apply to every button on the page the way the disc's own hover
   * state does. An element joins by saying so.
   */
  it('leaves an unmarked element alone', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const target = mountTarget({ bare: false })

    move(200, 150)
    hover(target)
    flushFrames(20)

    expect(shape().opacity).toBe(0)
    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(false)

    cursor.destroy()
  })

  /**
   * `include` widens the set; it can never narrow it. Scoping a region and
   * marking an element outside it is exactly the mistake our own site shipped —
   * nine elements marked, five of them silently doing nothing.
   */
  it('merges with a marked element outside `include`', () => {
    const region = document.createElement('div')
    region.className = 'region'
    document.body.appendChild(region)

    const cursor = createMagnetCursor({
      ...BASE,
      morph: { include: '.region button', duration: 0.05, drift: 0 },
    })

    const inside = mountTarget({ bare: false })
    region.appendChild(inside)
    const outside = mountTarget()

    move(200, 150)
    hover(inside)
    flushFrames(20)
    expect(shape().opacity).toBe(1)

    hover(outside)
    flushFrames(20)
    expect(shape().opacity).toBe(1)
    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(true)

    cursor.destroy()
  })

  /** `none` still refuses, which is the only way out of an `include` region. */
  it('lets an element inside `include` opt back out', () => {
    const region = document.createElement('div')
    region.className = 'region'
    document.body.appendChild(region)

    const cursor = createMagnetCursor({
      ...BASE,
      morph: { include: '.region button', duration: 0.05, drift: 0 },
    })

    const refusing = mountTarget({ bare: false })
    refusing.setAttribute('data-magnet-cursor-morph', 'none')
    region.appendChild(refusing)

    move(200, 150)
    hover(refusing)
    flushFrames(20)

    expect(shape().opacity).toBe(0)
    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(false)

    cursor.destroy()
  })

  /**
   * Carrying the attribute with no value is the shorthand for "merge, however
   * the cursor normally merges" — the attribute selector matches any value, and
   * anything that is not a known mode falls back to `morph.mode`.
   */
  it('takes `morph.mode` for an element that names no mode', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { mode: 'border', duration: 0.05 } })
    const target = mountTarget()

    move(200, 150)
    hover(target)
    flushFrames(20)

    expect(cursor.element!.classList.contains('magnet-cursor--morph-border')).toBe(true)
    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(true)

    cursor.destroy()
  })

  /**
   * The class is what the stylesheet paints from, so a mode left over from the
   * last element is not cosmetic: `--morph-border` masks the middle out of the
   * layer, so a stale one would punch a hole in the next fill that lands.
   */
  it('drops the previous mode when an element opts out', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const el = cursor.element!

    const tracing = mountTarget()
    tracing.setAttribute('data-magnet-cursor-morph', 'border')
    const refusing = mountTarget()
    refusing.setAttribute('data-magnet-cursor-morph', 'none')

    move(200, 150)
    hover(tracing)
    flushFrames(20)
    expect(el.classList.contains('magnet-cursor--morph-border')).toBe(true)

    hover(refusing)
    flushFrames(20)
    expect(el.classList.contains('magnet-cursor--morph-border')).toBe(false)
    expect(el.classList.contains('magnet-cursor--merged')).toBe(false)

    cursor.destroy()
  })

  /**
   * The bug this pins: the mode used to be dropped the moment the pointer left,
   * so a ring stopped being a ring while it was still shrinking — the border
   * class came off and the fill's reveal came on, and a traced element exited
   * as a solid one.
   */
  it('lets a traced element finish its exit as a trace', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.1, drift: 0 } })
    const el = cursor.element!
    const layer = document.querySelector<HTMLElement>('.magnet-cursor__morph')!

    const tracing = mountTarget()
    tracing.setAttribute('data-magnet-cursor-morph', 'border')

    move(200, 150)
    hover(tracing)
    flushFrames(40)
    expect(el.classList.contains('magnet-cursor--morph-border')).toBe(true)

    // Mid-release: still a ring, still no fill.
    unhover()
    flushFrames(2)
    expect(shape().opacity).toBeGreaterThan(0)
    expect(el.classList.contains('magnet-cursor--morph-border')).toBe(true)
    expect(layer.style.clipPath).toBe('')
    expect(Number(el.style.getPropertyValue('--mc-fill-amount'))).toBe(0)

    // ...and the mode goes with the last frame that painted it.
    flushFrames(40)
    expect(el.classList.contains('magnet-cursor--morph-border')).toBe(false)

    cursor.destroy()
  })

  it('nudges once the pointer has been still, and only then', () => {
    const cursor = createMagnetCursor({
      ...BASE,
      morph: {
        duration: 0.05,
        drift: 0,
        idle: { after: 0.5, every: 1, duration: 0.4, strength: 1 },
      },
    })
    const target = mountTarget()
    move(200, 150)
    hover(target)

    // Merged, but not still for long enough yet.
    flushFrames(20)
    expect(shape().width).toBe(200)

    // Past `after`, the shape swells and comes back.
    flushFrames(12)
    expect(shape().width).toBeGreaterThan(200)

    // A move resets the stillness, so the nudge stops.
    move(201, 150)
    flushFrames(4)
    expect(shape().width).toBe(200)

    cursor.destroy()
  })

  it('keeps hold of the element when options are handed over again', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05, drift: 0 } })
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(20)
    expect(shape().width).toBe(200)

    // Options usually arrive as a whole object, and one of the things that
    // triggers a re-render is the item state changing — the exact moment the
    // merge begins. Rebuilding here would drop the target mid-merge.
    cursor.setOptions({ morph: { duration: 0.05, drift: 0 } })
    flushFrames(2)
    expect(shape().width).toBe(200)
    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(true)

    cursor.destroy()
  })

  it('holds the render loop open while merged, so a moving target is tracked', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: { duration: 0.05 } })
    const target = mountTarget()
    move(200, 150)
    hover(target)
    flushFrames(30)

    // Deliberate: nothing tells us when the element underneath moves, and the
    // nudge needs a heartbeat.
    expect(pendingFrames()).toBe(1)

    unhover()
    flushFrames(60)
    expect(pendingFrames()).toBe(0)

    cursor.destroy()
  })
})
