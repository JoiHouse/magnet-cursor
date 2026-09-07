import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMagnetCursor } from '../src/cursor'

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

const move = (clientX: number, clientY: number) =>
  document.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }))
const hover = (el: Element) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
const unhover = () => document.body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

/** jsdom has no layout: a 200x40 link sitting at (100, 100). */
const mountLink = (value?: string) => {
  const el = document.createElement('a')
  if (value !== undefined) el.setAttribute('data-magnet-cursor-underline', value)
  Object.defineProperty(el, 'offsetWidth', { value: 200, configurable: true })
  Object.defineProperty(el, 'offsetHeight', { value: 40, configurable: true })
  el.getBoundingClientRect = () =>
    ({ left: 100, top: 100, width: 200, height: 40, right: 300, bottom: 140 }) as DOMRect
  document.body.appendChild(el)
  return el
}

const layer = () => document.querySelector<HTMLElement>('.magnet-cursor__underline')!

/** The `scaleX` the wipe is currently at. */
const drawn = () => {
  const found = /scaleX\(([\d.]+)\)/.exec(layer().style.transform)
  return found ? Number.parseFloat(found[1]!) : 0
}

describe('cursor underline', () => {
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
    document.documentElement.className = ''
  })

  it('adds no layer at all when the underline is off', () => {
    const cursor = createMagnetCursor(BASE)
    expect(document.querySelector('.magnet-cursor__underline')).toBeNull()
    expect(cursor.element!.classList.contains('magnet-cursor--underline')).toBe(false)
    cursor.destroy()
  })

  /** Same rule as the merge: carrying the attribute is what joins an element in. */
  it('draws under a marked element and leaves an unmarked one alone', () => {
    const cursor = createMagnetCursor({ ...BASE, underline: { duration: 0.05 } })
    const marked = mountLink('')
    const plain = mountLink()

    move(200, 150)
    hover(plain)
    flushFrames(20)
    expect(layer().style.opacity).toBe('0')

    hover(marked)
    flushFrames(20)
    expect(drawn()).toBeCloseTo(1, 2)
    expect(layer().style.opacity).toBe('1')

    cursor.destroy()
  })

  it('withdraws when the pointer leaves', () => {
    const cursor = createMagnetCursor({ ...BASE, underline: { duration: 0.05 } })
    const link = mountLink('solid')
    move(200, 150)
    hover(link)
    flushFrames(20)
    expect(drawn()).toBeCloseTo(1, 2)

    unhover()
    flushFrames(20)
    expect(layer().style.opacity).toBe('0')

    cursor.destroy()
  })

  it('lets an element refuse with none', () => {
    const cursor = createMagnetCursor({ ...BASE, underline: { duration: 0.05 } })
    const link = mountLink('none')
    move(200, 150)
    hover(link)
    flushFrames(20)
    expect(layer().style.opacity).toBe('0')
    cursor.destroy()
  })

  /**
   * `include` widens the set and can never narrow it — the same guarantee the
   * merge carries, and for the same reason: a region written in one place must
   * not be able to void an attribute written in another.
   */
  it('draws under a marked element outside include', () => {
    const region = document.createElement('div')
    region.className = 'region'
    document.body.appendChild(region)

    const cursor = createMagnetCursor({
      ...BASE,
      underline: { include: '.region a', duration: 0.05 },
    })

    const inside = mountLink()
    region.appendChild(inside)
    const outside = mountLink('')

    move(200, 150)
    hover(inside)
    flushFrames(20)
    expect(drawn()).toBeCloseTo(1, 2)

    hover(outside)
    flushFrames(20)
    expect(drawn()).toBeCloseTo(1, 2)

    cursor.destroy()
  })

  it('takes the style the element names, and falls back to the option', () => {
    const cursor = createMagnetCursor({ ...BASE, underline: { style: 'dashed', duration: 0.05 } })
    const wavy = mountLink('wavy')
    const bare = mountLink('')

    move(200, 150)
    hover(wavy)
    flushFrames(20)
    expect(layer().className).toContain('--wavy')

    hover(bare)
    flushFrames(20)
    expect(layer().className).toContain('--dashed')
    expect(layer().className).not.toContain('--wavy')

    cursor.destroy()
  })

  /** The wipe end is the whole of the direction. */
  it.each([
    ['left', 'left center'],
    ['right', 'right center'],
  ] as const)('grows from the %s', (direction, origin) => {
    const cursor = createMagnetCursor({ ...BASE, underline: { direction, duration: 0.05 } })
    const link = mountLink('')
    move(200, 150)
    hover(link)
    flushFrames(20)
    expect(layer().style.transformOrigin).toBe(origin)
    cursor.destroy()
  })

  it('takes the element’s width and sits under its bottom edge', () => {
    const cursor = createMagnetCursor({ ...BASE, underline: { duration: 0.05, offset: 6 } })
    const link = mountLink('')
    move(200, 150)
    hover(link)
    flushFrames(30)

    expect(Math.round(Number.parseFloat(layer().style.width))).toBe(200)

    // The root is the layer's containing block, so the two translations add up
    // to a viewport position: the element's left edge, 6px under its bottom.
    const inside = (el: HTMLElement) => {
      const [x, y] = /translate3d\(([^)]+)\)/
        .exec(el.style.transform)![1]!
        .split(',')
        .map(Number.parseFloat) as [number, number]
      return { x, y }
    }
    const root = inside(cursor.element!)
    const line = inside(layer())
    expect(Math.round(root.x + line.x)).toBe(100)
    expect(Math.round(root.y + line.y)).toBe(146)

    cursor.destroy()
  })

  /**
   * The merge turns the cursor into the element. A rule beneath it as well
   * would be two claims about the same element at once.
   */
  it('leaves a merging element to the merge', () => {
    const cursor = createMagnetCursor({
      ...BASE,
      morph: { duration: 0.05 },
      underline: { duration: 0.05 },
    })
    const both = mountLink('')
    both.setAttribute('data-magnet-cursor-morph', 'fill')

    move(200, 150)
    hover(both)
    flushFrames(30)

    expect(cursor.element!.classList.contains('magnet-cursor--merged')).toBe(true)
    expect(layer().style.opacity).toBe('0')

    cursor.destroy()
  })

  it('follows a rotated element', () => {
    const cursor = createMagnetCursor({ ...BASE, underline: { duration: 0.05 } })
    const holder = document.createElement('div')
    holder.style.transform = 'matrix(0.994522, -0.104528, 0.104528, 0.994522, 0, 0)'
    document.body.appendChild(holder)

    const link = mountLink('')
    holder.appendChild(link)

    move(200, 150)
    hover(link)
    flushFrames(30)

    const angle = Number.parseFloat(/rotate\(([-\d.]+)deg\)/.exec(layer().style.transform)![1]!)
    expect(angle).toBeCloseTo(-6, 1)

    cursor.destroy()
  })
})
