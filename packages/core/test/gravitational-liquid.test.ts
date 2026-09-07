import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGravitationalLiquid } from '../src/gravitational-liquid'

const BASE = { detectPointer: false, respectReducedMotion: false } as const
const ATTRIBUTE = 'data-magnet-cursor-gravitating'

let frames = new Map<number, FrameRequestCallback>()
let nextFrameId = 1
let clock = 0
const FRAME_60 = 1000 / 60

let observers: { callback: ResizeObserverCallback; targets: Element[]; live: boolean }[] = []

const pendingFrames = () => frames.size

const flushFrames = (count = 1, stepMs = FRAME_60) => {
  for (let i = 0; i < count; i += 1) {
    clock += stepMs
    const due = [...frames.values()]
    frames.clear()
    for (const cb of due) cb(clock)
  }
}

const runUntilIdle = (limit = 1000) => {
  let ran = 0
  while (pendingFrames() > 0 && ran < limit) {
    flushFrames(1)
    ran += 1
  }
  return ran
}

/**
 * jsdom has no layout: a 200x100 surface positioned at (100, 100).
 *
 * The SVG reports the same box, because it is `inset: 0` inside the element —
 * that is the box the filter region is measured from.
 */
let surfaceBox = { width: 200, height: 100 }

const rectOf = () =>
  ({
    left: 100,
    top: 100,
    width: surfaceBox.width,
    height: surfaceBox.height,
    right: 100 + surfaceBox.width,
    bottom: 100 + surfaceBox.height,
  }) as DOMRect

const mountSurface = (background = '#111') => {
  const el = document.createElement('button')
  el.style.background = background
  el.getBoundingClientRect = rectOf
  document.body.appendChild(el)
  return el
}

const point = (el: HTMLElement, type: string, clientX: number, clientY: number) =>
  el.dispatchEvent(new MouseEvent(type, { clientX, clientY }))

const translate = (g: SVGElement) => {
  const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(g.style.transform)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null
}

const stretchOf = (g: SVGElement) => {
  const m = /rotate\(([-\d.e]+)deg\) scale\(([-\d.e]+), ([-\d.e]+)\)/.exec(g.style.transform)
  return m ? { angle: Number(m[1]), x: Number(m[2]), y: Number(m[3]) } : null
}

const scaleOf = (g: SVGElement) => Number(/scale\(([-\d.e]+)\)/.exec(g.style.transform)![1])

const follow = (el: HTMLElement) => el.querySelector<SVGGElement>('.mc-liquid-follow')!
const stretchGroup = (el: HTMLElement) => el.querySelector<SVGGElement>('.mc-liquid-stretch')!
const biteGroup = (el: HTMLElement) => el.querySelector<SVGGElement>('.mc-liquid-bite')!

describe('createGravitationalLiquid', () => {
  beforeEach(() => {
    frames = new Map()
    observers = []
    surfaceBox = { width: 200, height: 100 }
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockImplementation(rectOf)
    nextFrameId = 1
    clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, cb)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames.delete(id)
    })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(public callback: ResizeObserverCallback) {
          observers.push({ callback, targets: [], live: true })
        }
        observe(target: Element) {
          observers[observers.length - 1]!.targets.push(target)
        }
        unobserve() {}
        disconnect() {
          const own = observers.find((o) => o.callback === this.callback)
          if (own) own.live = false
        }
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    document.documentElement.removeAttribute(ATTRIBUTE)
  })

  it('warns instead of silently flooding an element with no surface colour', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = mountSurface('transparent')
    const liquid = createGravitationalLiquid(el, BASE)

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no opaque background colour'))

    liquid.destroy()
  })

  it('paints a surface over the element and restores it on destroy', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    expect(liquid.enabled).toBe(true)
    const svg = el.querySelector('svg')!
    expect(svg).not.toBeNull()
    expect(svg.querySelectorAll('rect')).toHaveLength(3) // mask backdrop, reveal, surface
    expect(el.style.backgroundColor).toBe('transparent')
    expect(el.style.isolation).toBe('isolate')

    liquid.destroy()
    expect(el.querySelector('svg')).toBeNull()
    // Only the colour was ever taken over, so only the colour is handed back.
    expect(el.style.backgroundColor).toBe('rgb(17, 17, 17)')
    expect(el.style.isolation).toBe('')
  })

  it('starts closed, so the liquid colour cannot show before a hover', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    // The loop does not run until the pointer arrives; the resting pose has to
    // already be on the element or the mask punches a hole through the middle.
    expect(biteGroup(el).style.transform).toBe('scale(0)')
    expect(pendingFrames()).toBe(0)

    liquid.destroy()
  })

  it('erodes through a mask rather than drawing on top', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)
    const svg = el.querySelector('svg')!

    const mask = svg.querySelector('mask')!
    // White fills the surface, the black circle is what gets subtracted.
    expect(mask.querySelector('rect')!.getAttribute('fill')).toBe('#fff')
    expect(mask.querySelector('circle')!.getAttribute('fill')).toBe('#000')

    expect(svg.querySelector('.mc-liquid-surface')!.getAttribute('mask')).toMatch(
      /^url\(#mc-liquid-bite-/,
    )
    expect(svg.querySelector('.mc-liquid-reveal')!.getAttribute('fill')).toBe('#ff3737')

    liquid.destroy()
  })

  it('sizes the filter region by absolute spill, not by a fraction of the element', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)
    const filter = el.querySelector('filter')!

    // 3 blur radii (24) + the blob's own radius (40) + 2px of slack.
    expect(filter.getAttribute('filterUnits')).toBe('userSpaceOnUse')
    expect(filter.getAttribute('x')).toBe('-66')
    expect(filter.getAttribute('y')).toBe('-66')
    expect(filter.getAttribute('width')).toBe('332')
    expect(filter.getAttribute('height')).toBe('232')

    liquid.destroy()
  })

  it('measures the filter region from the SVG, not from the content box', () => {
    // The SVG is inset:0 inside the element, so its box is the element's
    // padding box. A padded button's content box is much smaller, and sizing
    // the region from it cuts the bite off flat wherever it runs past.
    const el = mountSurface()
    el.getBoundingClientRect = () =>
      ({ left: 100, top: 100, width: 90, height: 32, right: 190, bottom: 132 }) as DOMRect
    const liquid = createGravitationalLiquid(el, BASE)

    expect(el.querySelector('filter')!.getAttribute('width')).toBe('332')
    expect(el.querySelector('filter')!.getAttribute('height')).toBe('232')

    liquid.destroy()
  })

  it('re-fits the filter region when the element is resized', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)
    const filter = el.querySelector('filter')!

    expect(observers[0]!.targets).toEqual([el])
    surfaceBox = { width: 400, height: 300 }
    observers[0]!.callback([] as ResizeObserverEntry[], {} as ResizeObserver)
    expect(filter.getAttribute('width')).toBe('532')
    expect(filter.getAttribute('height')).toBe('432')

    liquid.destroy()
    expect(observers[0]!.live).toBe(false)
  })

  it('lands the blob where the pointer entered, then trails it', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    // Centre is (200, 150); entering at (300, 200) is an offset of (100, 50).
    point(el, 'pointerenter', 300, 200)
    flushFrames(1)
    expect(translate(follow(el))).toEqual({ x: 100, y: 50 })

    // A move is chased, not snapped to.
    point(el, 'pointermove', 200, 150)
    flushFrames(1)
    const after = translate(follow(el))!
    expect(after.x).toBeGreaterThan(0)
    expect(after.x).toBeLessThan(100)

    runUntilIdle()
    expect(translate(follow(el))!.x).toBeCloseTo(0, 2)

    liquid.destroy()
  })

  it('is thrown past the pointer and drawn back when elastic', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, { ...BASE, elasticity: 0.9 })

    point(el, 'pointerenter', 300, 200)
    flushFrames(1)
    point(el, 'pointermove', 200, 150)

    let minimum = Number.POSITIVE_INFINITY
    while (pendingFrames() > 0) {
      flushFrames(1)
      minimum = Math.min(minimum, translate(follow(el))!.x)
    }

    // It passes through the pointer instead of easing onto it…
    expect(minimum).toBeLessThan(0)
    // …and still comes to rest exactly on it.
    expect(translate(follow(el))!.x).toBeCloseTo(0, 2)

    liquid.destroy()
  })

  it('never passes the pointer when elasticity is 0', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, { ...BASE, elasticity: 0 })

    point(el, 'pointerenter', 300, 200)
    flushFrames(1)
    point(el, 'pointermove', 200, 150)

    let minimum = Number.POSITIVE_INFINITY
    while (pendingFrames() > 0) {
      flushFrames(1)
      minimum = Math.min(minimum, translate(follow(el))!.x)
    }

    expect(minimum).toBeGreaterThanOrEqual(-0.01)

    liquid.destroy()
  })

  it('stretches along the lag and preserves area', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    point(el, 'pointerenter', 300, 200)
    flushFrames(1)
    // Straight left along -x, so the long axis should end up near 0/180°.
    point(el, 'pointermove', 120, 200)
    flushFrames(6)

    const pose = stretchOf(stretchGroup(el))!
    expect(pose.x).toBeGreaterThan(1)
    expect(pose.x * pose.y).toBeCloseTo(1, 10)
    expect(Math.abs(pose.angle)).toBeLessThan(1)

    liquid.destroy()
  })

  it('relaxes to a circle once the blob has caught up', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    point(el, 'pointerenter', 300, 200)
    flushFrames(1)
    point(el, 'pointermove', 120, 200)
    runUntilIdle()

    expect(stretchOf(stretchGroup(el))!.x).toBe(1)

    liquid.destroy()
  })

  it('takes the short way round when the pointer reverses direction', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    point(el, 'pointerenter', 200, 150)
    flushFrames(1)
    point(el, 'pointermove', 290, 150)
    flushFrames(8)
    const before = stretchOf(stretchGroup(el))!.angle

    point(el, 'pointermove', 110, 150)
    // The lag flips to point the other way. Because scale(s, 1/s) is symmetric
    // under a half turn, the angle must not spin 180° to describe it.
    const swept: number[] = []
    for (let i = 0; i < 8; i += 1) {
      flushFrames(1)
      swept.push(stretchOf(stretchGroup(el))!.angle)
    }
    for (const angle of swept) expect(Math.abs(angle - before)).toBeLessThan(90)

    liquid.destroy()
  })

  it('opens the bite on enter and closes it on leave', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    point(el, 'pointerenter', 300, 200)
    runUntilIdle()
    expect(biteGroup(el).style.transform).toBe('scale(1)')

    point(el, 'pointerleave', 300, 200)
    runUntilIdle()
    expect(scaleOf(biteGroup(el))).toBe(0)

    liquid.destroy()
  })

  it('goes idle once the blob has caught up', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    point(el, 'pointerenter', 300, 200)
    runUntilIdle()
    expect(pendingFrames()).toBe(0)

    point(el, 'pointermove', 150, 120)
    expect(pendingFrames()).toBe(1)

    liquid.destroy()
  })

  it('wakes on scroll, so a parked blob cannot be left at a stale offset', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    point(el, 'pointerenter', 300, 200)
    runUntilIdle()
    expect(pendingFrames()).toBe(0)

    window.dispatchEvent(new Event('scroll'))
    expect(pendingFrames()).toBe(1)
    runUntilIdle()

    // …and stops listening once the pointer is gone.
    point(el, 'pointerleave', 300, 200)
    runUntilIdle()
    window.dispatchEvent(new Event('scroll'))
    expect(pendingFrames()).toBe(0)

    liquid.destroy()
  })

  it('clamps options that have no meaningful value out of range', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, { ...BASE, size: -20, tension: -4, maxStretch: 0 })

    expect(el.querySelector('circle')!.getAttribute('r')).toBe('0.5')
    expect(el.querySelector('feGaussianBlur')!.getAttribute('stdDeviation')).toBe('0')

    point(el, 'pointerenter', 300, 200)
    flushFrames(1)
    point(el, 'pointermove', 120, 200)
    flushFrames(6)
    // maxStretch below 1 would invert the ellipse; clamped, it simply cannot stretch.
    expect(stretchOf(stretchGroup(el))!.x).toBe(1)

    liquid.destroy()
  })

  it('pushes changed options through to the paint', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, BASE)

    liquid.setOptions({ size: 120, tension: 12, liquidColor: '#0af', rounded: 9 })

    expect(el.querySelector('circle')!.getAttribute('r')).toBe('60')
    expect(el.querySelector('feGaussianBlur')!.getAttribute('stdDeviation')).toBe('12')
    expect(el.querySelector('.mc-liquid-reveal')!.getAttribute('fill')).toBe('#0af')
    expect(el.querySelector('.mc-liquid-surface')!.getAttribute('rx')).toBe('9')
    // 3 * 12 + 60 + 2
    expect(el.querySelector('filter')!.getAttribute('x')).toBe('-98')

    liquid.destroy()
  })

  it('reference counts the global cursor suppression', () => {
    const first = mountSurface()
    const second = mountSurface()
    const a = createGravitationalLiquid(first, BASE)
    const b = createGravitationalLiquid(second, BASE)
    const root = document.documentElement

    point(first, 'pointerenter', 300, 200)
    point(second, 'pointerenter', 300, 200)
    expect(root.hasAttribute(ATTRIBUTE)).toBe(true)

    point(first, 'pointerleave', 300, 200)
    expect(root.hasAttribute(ATTRIBUTE)).toBe(true)

    point(second, 'pointerleave', 300, 200)
    expect(root.hasAttribute(ATTRIBUTE)).toBe(false)

    a.destroy()
    b.destroy()
  })

  it('reconciles hideCursor in both directions while the pointer is inside', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, { ...BASE, hideCursor: false })
    const root = document.documentElement

    point(el, 'pointerenter', 300, 200)
    expect(root.hasAttribute(ATTRIBUTE)).toBe(false)

    // No event follows an option change, so setOptions has to claim it itself.
    liquid.setOptions({ hideCursor: true })
    expect(root.hasAttribute(ATTRIBUTE)).toBe(true)

    liquid.setOptions({ hideCursor: false })
    expect(root.hasAttribute(ATTRIBUTE)).toBe(false)

    liquid.destroy()
  })

  it('is a no-op instance when pointer detection rejects the device', () => {
    const el = mountSurface()
    const liquid = createGravitationalLiquid(el, { detectPointer: true })

    expect(liquid.enabled).toBe(false)
    expect(el.querySelector('svg')).toBeNull()
  })
})
