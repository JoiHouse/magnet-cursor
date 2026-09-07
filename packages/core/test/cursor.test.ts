import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMagnetCursor } from '../src/cursor'

const BASE = { detectPointer: false, respectReducedMotion: false } as const

/** The goo filter lives on the liquid body, not on the root. */
const body = (el: HTMLElement) => el.querySelector<HTMLElement>('.magnet-cursor__body')!

/** Pending `requestAnimationFrame` callbacks, keyed by the id we handed out. */
let frames = new Map<number, FrameRequestCallback>()
let nextFrameId = 1

/**
 * Virtual clock, in ms. The cursor integrates over elapsed time, so the tests
 * drive both the frame queue and `performance.now()` from this one value.
 */
let clock = 0
const FRAME_60 = 1000 / 60

const pendingFrames = () => frames.size

/** Run `count` animation frames, letting each one schedule its successor. */
const flushFrames = (count = 1, stepMs = FRAME_60) => {
  for (let i = 0; i < count; i += 1) {
    clock += stepMs
    const due = [...frames.values()]
    frames.clear()
    for (const cb of due) cb(clock)
  }
}

/** Drain the loop until it settles, returning how many frames it took. */
const runUntilIdle = (limit = 500, stepMs = FRAME_60) => {
  let ran = 0
  while (pendingFrames() > 0 && ran < limit) {
    flushFrames(1, stepMs)
    ran += 1
  }
  return ran
}

/** X offset the cursor element currently sits at. */
const translateX = (el: HTMLElement) =>
  Number(/translate3d\(([-\d.]+)px/.exec(el.style.transform)?.[1])

const setDocumentHidden = (value: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })
}

const move = (clientX: number, clientY: number) => {
  document.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }))
}

/**
 * Give the cursor its first pointer reading and let it settle.
 *
 * Nothing is drawn or animated before this: the cursor stays hidden until it
 * knows where the pointer is, then lands on it. Tests that need it to travel
 * have to seed it first, or the move they make is the reading it lands on.
 */
const seed = (clientX = 512, clientY = 384) => {
  move(clientX, clientY)
  runUntilIdle()
}

describe('createMagnetCursor', () => {
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
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames.delete(id)
    })
    setDocumentHidden(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-magnet-cursor')
    // @ts-expect-error restoring the prototype getter jsdom ships with
    delete document.hidden
  })

  it('mounts one element and marks the document', () => {
    const cursor = createMagnetCursor(BASE)

    expect(cursor.enabled).toBe(true)
    expect(document.querySelectorAll('.magnet-cursor')).toHaveLength(1)
    expect(document.documentElement.dataset.magnetCursor).toBe('enabled')

    cursor.destroy()
    expect(document.querySelectorAll('.magnet-cursor')).toHaveLength(0)
    expect(document.documentElement.dataset.magnetCursor).toBeUndefined()
  })

  it('exposes options as CSS custom properties', () => {
    const cursor = createMagnetCursor({ ...BASE, color: '#f00', size: 120, scale: 0.5 })
    const el = cursor.element!

    expect(el.style.getPropertyValue('--mc-color')).toBe('#f00')
    expect(el.style.getPropertyValue('--mc-size')).toBe('120px')
    expect(el.style.getPropertyValue('--mc-scale')).toBe('0.5')

    cursor.setOptions({ color: '#00f' })
    expect(el.style.getPropertyValue('--mc-color')).toBe('#00f')

    cursor.destroy()
  })

  it('blends with the page instead of covering it when asked', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!

    // Default is opt-out: a plain cursor must not silently invert the page.
    expect(el.style.getPropertyValue('--mc-blend')).toBe('normal')

    cursor.setOptions({ blendMode: 'difference' })
    expect(el.style.getPropertyValue('--mc-blend')).toBe('difference')

    cursor.destroy()
  })

  it('writes the documented defaults when no options are given', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!

    // These values are part of the public contract and match the stylesheet defaults.
    expect(el.style.getPropertyValue('--mc-size')).toBe('10rem')
    expect(el.style.getPropertyValue('--mc-scale')).toBe('0.07')
    expect(el.style.getPropertyValue('--mc-item-scale')).toBe('0.2')
    expect(el.style.getPropertyValue('--mc-color')).toBe('rgba(0, 0, 0, 0.1)')

    cursor.destroy()
  })

  it('toggles the item modifier when hovering matching elements', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!
    const link = document.createElement('a')
    document.body.appendChild(link)

    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(el.classList.contains('magnet-cursor--item')).toBe(true)

    document.body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(el.classList.contains('magnet-cursor--item')).toBe(false)

    cursor.destroy()
  })

  it('hides itself when the pointer leaves the document', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!

    document.dispatchEvent(new MouseEvent('mouseleave'))
    expect(el.classList.contains('magnet-cursor--hidden')).toBe(true)

    document.dispatchEvent(new MouseEvent('mouseenter'))
    expect(el.classList.contains('magnet-cursor--hidden')).toBe(false)

    cursor.destroy()
  })

  /**
   * Leaving the window fires `mouseout` and never a last `mouseover`, so a
   * pointer that shoots off the edge from a link is the last thing the item
   * state hears about. Held, it outranks `--hidden` in the stylesheet and the
   * disc stays painted where the pointer left.
   */
  it('drops the hover state when the pointer leaves the document', () => {
    const items: boolean[] = []
    const cursor = createMagnetCursor({
      ...BASE,
      pinSelector: '[data-pin]',
      onItemChange: (isItem) => items.push(isItem),
    })
    const el = cursor.element!
    const link = document.createElement('a')
    link.setAttribute('data-pin', '')
    link.setAttribute('data-magnet-cursor-color', 'red')
    document.body.appendChild(link)

    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(el.classList.contains('magnet-cursor--item')).toBe(true)
    expect(el.classList.contains('magnet-cursor--pinned')).toBe(true)
    expect(el.style.getPropertyValue('--mc-override-color')).toBe('red')

    document.dispatchEvent(new MouseEvent('mouseleave'))
    expect(el.classList.contains('magnet-cursor--item')).toBe(false)
    expect(el.classList.contains('magnet-cursor--pinned')).toBe(false)
    expect(el.style.getPropertyValue('--mc-override-color')).toBe('')
    expect(items).toEqual([true, false])

    cursor.destroy()
  })

  it('is a no-op instance when pointer detection rejects the device', () => {
    const cursor = createMagnetCursor({ detectPointer: true })

    expect(cursor.enabled).toBe(false)
    expect(cursor.element).toBeNull()
    expect(document.querySelectorAll('.magnet-cursor')).toHaveLength(0)
  })

  it('stays hidden and idle until the pointer has been seen', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!

    // Nothing is known about the pointer yet, so nothing is shown and no frame
    // is asked for — otherwise the cursor would flash in the viewport centre.
    expect(el.classList.contains('magnet-cursor--hidden')).toBe(true)
    expect(pendingFrames()).toBe(0)
    flushFrames(10)
    expect(pendingFrames()).toBe(0)

    seed()
    expect(el.classList.contains('magnet-cursor--hidden')).toBe(false)

    cursor.destroy()
  })

  it('lands on the pointer instead of travelling to it from the centre', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!

    // The first reading is ~390px from where the cursor was initialised.
    move(900, 700)
    expect(translateX(el)).toBe(900)

    // And it is already there, so there is nothing left to animate.
    runUntilIdle()
    expect(translateX(el)).toBe(900)

    cursor.destroy()
  })

  it('lands on the pointer again after it leaves and comes back', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!
    seed(200, 200)

    document.dispatchEvent(new MouseEvent('mouseleave'))
    expect(el.classList.contains('magnet-cursor--hidden')).toBe(true)

    // Re-entering on the far side must not streak the cursor across the page.
    document.dispatchEvent(new MouseEvent('mouseenter', { clientX: 950, clientY: 640 }))
    expect(translateX(el)).toBe(950)
    expect(el.classList.contains('magnet-cursor--hidden')).toBe(false)

    cursor.destroy()
  })

  it('stops requesting frames once the cursor has settled', () => {
    const cursor = createMagnetCursor(BASE)
    seed()

    // Still pointer, no frames — however long we wait.
    expect(pendingFrames()).toBe(0)
    flushFrames(10)
    expect(pendingFrames()).toBe(0)

    cursor.destroy()
  })

  it('restarts the loop on mouse move and settles again', () => {
    const cursor = createMagnetCursor(BASE)
    seed()
    expect(pendingFrames()).toBe(0)

    move(900, 700)
    expect(pendingFrames()).toBe(1)

    const ran = runUntilIdle()
    expect(ran).toBeGreaterThan(1)
    expect(pendingFrames()).toBe(0)

    // A second move wakes it up all over again.
    move(100, 120)
    expect(pendingFrames()).toBe(1)

    cursor.destroy()
    expect(pendingFrames()).toBe(0)
  })

  it('pauses while the tab is hidden and resumes when it comes back', () => {
    const cursor = createMagnetCursor(BASE)
    seed()

    move(900, 700)
    expect(pendingFrames()).toBe(1)

    setDocumentHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(pendingFrames()).toBe(0)

    // Moves while hidden must not wake the loop either.
    move(400, 400)
    expect(pendingFrames()).toBe(0)

    setDocumentHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(pendingFrames()).toBe(1)

    cursor.destroy()
  })

  it('keeps a manual pause across a visibility round trip', () => {
    const cursor = createMagnetCursor(BASE)
    seed()

    move(900, 700)
    cursor.pause()
    expect(pendingFrames()).toBe(0)

    setDocumentHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    setDocumentHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(pendingFrames()).toBe(0)

    cursor.resume()
    expect(pendingFrames()).toBe(1)

    cursor.destroy()
  })

  it('deforms into a tail while moving and relaxes to a circle at rest', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!
    seed()
    expect(el.style.getPropertyValue('--mc-radius')).toBe('50%')

    // Centre is (512, 384); a jump to (900, 700) covers 500px, so the first
    // eased step of 100px saturates the default divisor. The deformation is low
    // passed, so it ramps in over several frames rather than landing at max,
    // and the corners move in five-percent steps so the paint they cost is
    // only paid when the shape visibly changes.
    move(900, 700)
    flushFrames(1)
    expect(el.style.getPropertyValue('--mc-radius')).toBe('45% 50% 50% 45% / 50% 50% 50% 50%')
    flushFrames(1)
    expect(el.style.getPropertyValue('--mc-radius')).toBe('40% 50% 50% 40% / 50% 50% 50% 50%')

    runUntilIdle()
    expect(el.style.getPropertyValue('--mc-radius')).toBe('50%')

    cursor.destroy()
  })

  it('stays a rigid circle when liquid is disabled', () => {
    const cursor = createMagnetCursor({ ...BASE, liquid: false })
    const el = cursor.element!
    seed()

    move(900, 700)
    runUntilIdle()
    expect(el.style.getPropertyValue('--mc-radius')).toBe('50%')

    cursor.destroy()
  })

  it('scales the tail with the configured amount', () => {
    const cursor = createMagnetCursor({ ...BASE, liquid: { tail: 1 } })
    const el = cursor.element!
    seed()

    move(900, 700)
    flushFrames(1)
    expect(el.style.getPropertyValue('--mc-radius')).toBe('40% 50% 50% 40% / 50% 50% 50% 50%')

    cursor.destroy()
  })

  it('covers the same ground per second at any refresh rate', () => {
    const travel = (stepMs: number, frameCount: number) => {
      const cursor = createMagnetCursor(BASE)
      const el = cursor.element!
      seed()

      move(900, 700)
      flushFrames(frameCount, stepMs)
      const x = translateX(el)

      cursor.destroy()
      return x
    }

    // 100ms of travel, once at 60Hz and once at 120Hz.
    const at60 = travel(FRAME_60, 6)
    const at120 = travel(FRAME_60 / 2, 12)

    expect(at60).toBeGreaterThan(512)
    expect(at120).toBeCloseTo(at60, 6)
  })

  it('does not lurch when the loop wakes after a long idle', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!
    seed()

    // Ten seconds pass with the loop parked, then the pointer moves one frame.
    clock += 10_000
    move(900, 700)
    flushFrames(1)

    // One 60Hz frame of easing is 20% of the 388px gap, not a teleport.
    expect(translateX(el)).toBeCloseTo(512 + 388 * 0.2, 6)

    cursor.destroy()
  })

  it('takes its fill from the hovered element and gives it back', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!
    const section = document.createElement('section')
    section.setAttribute('data-magnet-cursor-color', '#f0f')
    const link = document.createElement('a')
    section.appendChild(link)
    document.body.appendChild(section)

    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(el.style.getPropertyValue('--mc-override-color')).toBe('#f0f')

    document.body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(el.style.getPropertyValue('--mc-override-color')).toBe('')

    cursor.destroy()
  })

  it('honours a custom colour attribute', () => {
    const cursor = createMagnetCursor({ ...BASE, colorAttribute: 'data-tint' })
    const el = cursor.element!
    const box = document.createElement('div')
    box.setAttribute('data-tint', 'tomato')
    document.body.appendChild(box)

    box.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(el.style.getPropertyValue('--mc-override-color')).toBe('tomato')

    cursor.destroy()
  })

  it('has no trail and no filter unless asked for one', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!

    expect(el.querySelectorAll('.magnet-cursor__drop')).toHaveLength(0)
    expect(el.classList.contains('magnet-cursor--trail')).toBe(false)
    expect(body(el).style.filter).toBe('')
    expect(document.querySelector('svg')).toBeNull()

    cursor.destroy()
  })

  it('builds a bounded goo filter and a queue of drops', () => {
    const cursor = createMagnetCursor({ ...BASE, trail: { count: 3, box: 240 } })
    const el = cursor.element!

    expect(el.querySelectorAll('.magnet-cursor__drop')).toHaveLength(3)
    expect(el.classList.contains('magnet-cursor--trail')).toBe(true)
    expect(body(el).style.getPropertyValue('--mc-trail-box')).toBe('240px')
    expect(body(el).style.filter).toMatch(/^url\(#mc-goo-/)

    // The 10% SVG default would clip the blur exactly where the drops need to
    // reach each other, and an unbounded region would filter the whole viewport.
    const filter = document.querySelector('filter')!
    expect(filter.getAttribute('x')).toBe('-50%')
    expect(filter.getAttribute('width')).toBe('200%')

    cursor.destroy()
    expect(document.querySelector('filter')).toBeNull()
  })

  /**
   * The one arithmetic relationship the defaults have to satisfy.
   *
   * The goo filter saturates alpha, blurs by `goo`, then hard-thresholds at
   * `19a - 9`. A disc of radius r blurred by sigma has a centre alpha of
   * `1 - exp(-r^2 / 2 sigma^2)`, so it clears `9/19` only while
   * `r > 1.133 * goo`. Push `goo` past that for the thinnest drop and the trail
   * does not soften — it disappears, with no error and nothing on screen.
   *
   * `size` is passed explicitly because jsdom cannot resolve `'10rem'`; 160 is
   * what that default comes to on a 16px root.
   */
  it('keeps the default trail above the goo threshold at the default cursor size', () => {
    const cursor = createMagnetCursor({ ...BASE, size: 160, trail: {} })
    const el = cursor.element!

    try {
      const goo = Number(document.querySelector('feGaussianBlur')!.getAttribute('stdDeviation'))
      const size = Number.parseFloat(el.style.getPropertyValue('--mc-size'))
      const scale = Number(el.style.getPropertyValue('--mc-scale'))

      // `taper` shrinks each drop in turn, and the resting pose is written onto
      // the element, so the last drop's own transform carries the thinnest
      // radius the filter has to keep.
      const drops = [...el.querySelectorAll<HTMLElement>('.magnet-cursor__drop')]
      const last = drops[drops.length - 1]!
      const lastScale = Number(/scale\(([\d.]+)\)/.exec(last.style.transform)![1])

      const headRadius = (size * scale) / 2
      const survives = (r: number) => 1 - Math.exp(-(r * r) / (2 * goo * goo)) > 9 / 19

      expect(survives(headRadius)).toBe(true)
      expect(survives(headRadius * lastScale)).toBe(true)
    } finally {
      cursor.destroy()
    }
  })

  /**
   * The goo filter is destructive, so what it covers is part of the contract.
   *
   * It thresholds alpha to fuse the drops, which erases anything thinner than
   * roughly `1.13 * goo`. A border morph is a 2px ring, so putting the two under
   * one filter made `mode: 'border'` invisible whenever a trail was on — the
   * ring was not softened, it was deleted.
   */
  it('keeps the morph layer out of the filtered body', () => {
    const cursor = createMagnetCursor({
      ...BASE,
      trail: { count: 3 },
      morph: { mode: 'border' },
    })
    const el = cursor.element!
    const morph = el.querySelector<HTMLElement>('.magnet-cursor__morph')!

    expect(body(el).style.filter).toMatch(/^url\(#mc-goo-/)
    expect(body(el).contains(morph)).toBe(false)
    expect(morph.parentElement).toBe(el)
    // Still under the root, so the blend mode and the modifier classes reach it.
    expect(el.contains(morph)).toBe(true)

    // And it paints beneath the body: the disc stretches into the ring.
    expect(morph.compareDocumentPosition(body(el)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    cursor.destroy()
  })

  /*
   * An element can leave the page while the pointer is still on it — a modal
   * closing, a list item deleted, a route swapped — and no `mouseover` follows
   * a pointer that does not move. Nothing else hands the target back, so the
   * merge held a detached subtree, measured it every frame, kept the loop
   * awake, and painted the zero box a detached node reports while `--merged`
   * still hid the disc, the trail and the OS cursor. The screen had no cursor
   * on it at all until the pointer happened to move.
   */
  it('lets go of a merge target that leaves the document', () => {
    const cursor = createMagnetCursor({ ...BASE, morph: {} })
    const el = cursor.element!
    const card = document.createElement('div')
    card.setAttribute('data-magnet-cursor-morph', '')
    document.body.appendChild(card)
    seed()

    card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    flushFrames(20)
    expect(el.classList.contains('magnet-cursor--merged')).toBe(true)
    // A merge holds the loop open on purpose: the element under it can move.
    expect(pendingFrames()).toBeGreaterThan(0)

    card.remove()
    // No further pointer event — the frame loop is the only thing left to notice.
    expect(runUntilIdle()).toBeLessThan(500)
    expect(pendingFrames()).toBe(0)
    expect(el.classList.contains('magnet-cursor--merged')).toBe(false)
    expect(el.classList.contains('magnet-cursor--merging')).toBe(false)

    cursor.destroy()
  })

  it('lets go of an underline target that leaves the document', () => {
    const cursor = createMagnetCursor({ ...BASE, underline: {} })
    const el = cursor.element!
    const link = document.createElement('a')
    link.setAttribute('data-magnet-cursor-underline', '')
    document.body.appendChild(link)
    seed()

    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    flushFrames(20)
    const line = el.querySelector<HTMLElement>('.magnet-cursor__underline')!
    expect(line.style.opacity).toBe('1')
    expect(pendingFrames()).toBeGreaterThan(0)

    link.remove()
    expect(runUntilIdle()).toBeLessThan(500)
    expect(pendingFrames()).toBe(0)
    expect(line.style.opacity).toBe('0')

    cursor.destroy()
  })

  it('survives the goo threshold whatever the fill opacity is', () => {
    const cursor = createMagnetCursor({ ...BASE, trail: { count: 2, goo: 6 } })
    const stages = [...document.querySelectorAll('filter > *')].map((n) => ({
      tag: n.tagName,
      alphaRow: (n.getAttribute('values') || '').split(/\s+/).slice(-5).join(' '),
      blur: n.getAttribute('stdDeviation'),
    }))

    // The threshold wipes out anything fainter than ~0.47 alpha, so the shapes
    // have to be flattened to an opaque silhouette before it and faded back
    // after it. Merging on the raw translucent shapes erases the cursor.
    expect(stages.map((s) => s.tag)).toEqual([
      'feColorMatrix',
      'feGaussianBlur',
      'feColorMatrix',
      'feColorMatrix',
    ])
    expect(stages[0]!.alphaRow).toBe('0 0 0 100 0')
    expect(stages[1]!.blur).toBe('6')
    expect(stages[2]!.alphaRow).toBe('0 0 0 19 -9')
    expect(stages[3]!.alphaRow).toMatch(/^0 0 0 [\d.]+ 0$/)

    // The multiplier that flattens the drops has to stay under 128. WebKit
    // reduces it modulo 256 and reads 128..255 as negative, so the `255` this
    // was multiplied every drop's alpha by a negative number and rendered the
    // whole trail as nothing — the gooey trail was invisible in Safari.
    // Measured on WebKit: 127 draws, 128 does not; 300 draws, 1000 does not.
    // See the Safari notes in development/safari-compat.md (maintainer notes,
    // not published).
    const solid = Number(stages[0]!.alphaRow.split(' ')[3])
    expect(solid).toBeGreaterThan(0)
    expect(solid).toBeLessThan(128)

    cursor.destroy()
  })

  it('follows a colour change without resetting the trail', () => {
    const cursor = createMagnetCursor({ ...BASE, color: 'rgba(0, 0, 0, 0.4)', trail: { count: 3 } })
    const before = document.querySelector('filter')
    const restoredAlpha = () => {
      const values = [...document.querySelectorAll('filter feColorMatrix')]
        .pop()!
        .getAttribute('values')!
        .trim()
        .split(/\s+/)
      return Number(values[values.length - 2])
    }

    expect(restoredAlpha()).toBeCloseTo(0.4, 5)

    cursor.setOptions({ color: 'rgba(0, 0, 0, 0.05)' })
    expect(restoredAlpha()).toBeCloseTo(0.05, 5)

    // Same filter element, same drops: only the alpha stage is rewritten. A
    // rebuild would snap the drops back onto the head mid-drag, and options are
    // usually handed over whole, so `trail` is present on nearly every call.
    expect(document.querySelector('filter')).toBe(before)
    expect(document.querySelectorAll('.magnet-cursor__drop')).toHaveLength(3)

    cursor.destroy()
  })

  it('parks the drops on the head before the first frame', () => {
    const cursor = createMagnetCursor({ ...BASE, trail: { count: 2, taper: 0.6 } })
    const drops = [...cursor.element!.querySelectorAll<HTMLElement>('.magnet-cursor__drop')]

    // Zero offset, already tapered — anything else flashes on the first paint.
    // 2D `translate`, never `translate3d`: a drop that asks for its own
    // compositing layer is filtered on its own in Safari and never fuses with
    // its neighbours. See the Safari notes in development/safari-compat.md
    // (maintainer notes, not published).
    expect(drops[0]!.style.transform).toBe('translate(0px, 0px) scale(0.8)')
    expect(drops[1]!.style.transform).toBe('translate(0px, 0px) scale(0.6000000000000001)')
    for (const drop of drops) expect(drop.style.transform).not.toContain('translate3d')

    cursor.destroy()
  })

  it('strings the drops out behind the head and reels them back in', () => {
    const cursor = createMagnetCursor({ ...BASE, trail: { count: 3 } })
    const el = cursor.element!
    const offsets = () =>
      [...el.querySelectorAll<HTMLElement>('.magnet-cursor__drop')].map((drop) =>
        Number(/translate\(([-\d.]+)px/.exec(drop.style.transform)![1]),
      )
    seed()

    move(900, 700)
    flushFrames(4)

    // Each drop is lazier than the one ahead of it, so it lags further behind.
    const lag = offsets()
    expect(lag).toHaveLength(3)
    expect(lag[0]!).toBeLessThan(0)
    expect(lag[1]!).toBeLessThan(lag[0]!)
    expect(lag[2]!).toBeLessThan(lag[1]!)

    runUntilIdle()
    expect(offsets()).toEqual([0, 0, 0])
    expect(pendingFrames()).toBe(0)

    cursor.destroy()
  })

  it('keeps the loop alive until the trail has caught up', () => {
    const cursor = createMagnetCursor({ ...BASE, trail: { count: 3 } })
    seed()

    move(520, 390)
    // The head arrives quickly; the lazier drops are what hold the loop open.
    const ran = runUntilIdle()
    expect(ran).toBeGreaterThan(10)

    cursor.destroy()
  })

  it('tears the trail down when it is switched off', () => {
    const cursor = createMagnetCursor({ ...BASE, trail: { count: 3 } })
    const el = cursor.element!

    cursor.setOptions({ trail: false })
    expect(el.querySelectorAll('.magnet-cursor__drop')).toHaveLength(0)
    expect(el.classList.contains('magnet-cursor--trail')).toBe(false)
    expect(body(el).style.filter).toBe('')
    expect(document.querySelector('filter')).toBeNull()

    cursor.destroy()
  })

  it('reference counts the document marker across instances', () => {
    const first = createMagnetCursor(BASE)
    const second = createMagnetCursor(BASE)

    expect(document.querySelectorAll('.magnet-cursor')).toHaveLength(2)

    first.destroy()
    expect(document.querySelectorAll('.magnet-cursor')).toHaveLength(1)
    expect(document.documentElement.dataset.magnetCursor).toBe('enabled')

    second.destroy()
    expect(document.documentElement.dataset.magnetCursor).toBeUndefined()
  })

  it('hides and restores the native cursor at runtime', () => {
    const root = document.documentElement
    const cursor = createMagnetCursor(BASE)
    seed()

    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(false)

    cursor.setOptions({ hideNativeCursor: true })
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(true)

    cursor.setOptions({ hideNativeCursor: false })
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(false)

    cursor.destroy()
  })

  it('moves the hiding class when the base class is renamed', () => {
    const root = document.documentElement
    const cursor = createMagnetCursor({ ...BASE, hideNativeCursor: true })
    seed()

    cursor.setOptions({ className: 'ring' })
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(false)
    expect(root.classList.contains('ring-hide-native')).toBe(true)

    cursor.destroy()
    expect(root.classList.contains('ring-hide-native')).toBe(false)
  })

  it('reference counts the native-cursor-hiding class across instances', () => {
    const root = document.documentElement
    const first = createMagnetCursor({ ...BASE, hideNativeCursor: true })
    const second = createMagnetCursor({ ...BASE, hideNativeCursor: true })

    // Both are still waiting for a pointer, so the native cursor stays visible.
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(false)
    seed()
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(true)

    first.destroy()
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(true)

    second.destroy()
    expect(root.classList.contains('magnet-cursor-hide-native')).toBe(false)
  })

  it('keeps state modifiers when the base class is renamed', () => {
    const cursor = createMagnetCursor(BASE)
    const el = cursor.element!
    const link = document.createElement('a')
    document.body.appendChild(link)

    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(el.classList.contains('magnet-cursor--item')).toBe(true)

    cursor.setOptions({ className: 'ring' })
    expect(el.classList.contains('ring')).toBe(true)
    expect(el.classList.contains('ring--item')).toBe(true)
    expect(el.classList.contains('magnet-cursor')).toBe(false)
    expect(el.classList.contains('magnet-cursor--item')).toBe(false)

    // And the same for a state taken after the rename.
    document.dispatchEvent(new MouseEvent('mouseleave'))
    expect(el.classList.contains('ring--hidden')).toBe(true)

    cursor.destroy()
  })
  describe('dark theme', () => {
    /** jsdom has no matchMedia; the OS-preference branch has to be stubbed. */
    let mediaListeners: (() => void)[] = []
    let prefersDark = false

    const stubMatchMedia = () => {
      mediaListeners = []
      vi.stubGlobal('matchMedia', (query: string) => ({
        get matches() {
          return query.includes('prefers-color-scheme: dark') ? prefersDark : false
        },
        media: query,
        addEventListener: (_: string, cb: () => void) => mediaListeners.push(cb),
        removeEventListener: (_: string, cb: () => void) => {
          mediaListeners = mediaListeners.filter((l) => l !== cb)
        },
      }))
    }

    const setPrefersDark = (value: boolean) => {
      prefersDark = value
      for (const cb of [...mediaListeners]) cb()
    }

    /** jsdom delivers MutationObserver records in a later task. */
    const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

    const cssVar = (el: HTMLElement, name: string) => el.style.getPropertyValue(name)

    const LIGHT = {
      ...BASE,
      color: 'rgba(15, 23, 42, 0.16)',
      itemColor: 'rgba(139, 92, 246, 0.45)',
      blur: 6,
      scale: 0.2,
    } as const

    const DARK = {
      color: 'rgba(248, 250, 252, 0.18)',
      itemColor: 'rgba(167, 139, 250, 0.55)',
      blendMode: 'exclusion',
      scale: 0.3,
    } as const

    beforeEach(() => {
      prefersDark = false
      stubMatchMedia()
      document.documentElement.className = ''
      document.documentElement.removeAttribute('data-theme')
      document.documentElement.style.colorScheme = ''
    })

    afterEach(() => {
      document.documentElement.className = ''
      document.documentElement.removeAttribute('data-theme')
      document.documentElement.style.colorScheme = ''
    })

    it('paints the light palette when the page is light', () => {
      const cursor = createMagnetCursor({ ...LIGHT, dark: DARK })
      const el = cursor.element!

      expect(cssVar(el, '--mc-color')).toBe(LIGHT.color)
      expect(cssVar(el, '--mc-item-color')).toBe(LIGHT.itemColor)
      expect(cssVar(el, '--mc-blend')).toBe('normal')
      expect(cssVar(el, '--mc-scale')).toBe('0.2')

      cursor.destroy()
    })

    it('paints the dark palette when the page is already dark at mount', () => {
      document.documentElement.classList.add('dark')
      const cursor = createMagnetCursor({ ...LIGHT, dark: DARK })
      const el = cursor.element!

      expect(cssVar(el, '--mc-color')).toBe(DARK.color)
      expect(cssVar(el, '--mc-item-color')).toBe(DARK.itemColor)
      expect(cssVar(el, '--mc-blend')).toBe('exclusion')
      expect(cssVar(el, '--mc-scale')).toBe('0.3')

      cursor.destroy()
    })

    it('keeps every value the dark palette leaves out', () => {
      document.documentElement.classList.add('dark')
      const cursor = createMagnetCursor({ ...LIGHT, dark: { color: DARK.color } })
      const el = cursor.element!

      expect(cssVar(el, '--mc-color')).toBe(DARK.color)
      // Not overridden, so the light values stand.
      expect(cssVar(el, '--mc-item-color')).toBe(LIGHT.itemColor)
      expect(cssVar(el, '--mc-blur')).toBe('6px')
      expect(cssVar(el, '--mc-scale')).toBe('0.2')

      cursor.destroy()
    })

    it('repaints in place when the page toggles theme', async () => {
      const cursor = createMagnetCursor({ ...LIGHT, dark: DARK })
      const el = cursor.element!
      seed()

      document.documentElement.classList.add('dark')
      await flush()
      expect(cssVar(el, '--mc-color')).toBe(DARK.color)
      // Same element: a theme flip is a repaint, never a remount.
      expect(cursor.element).toBe(el)
      expect(el.isConnected).toBe(true)

      document.documentElement.classList.remove('dark')
      await flush()
      expect(cssVar(el, '--mc-color')).toBe(LIGHT.color)

      cursor.destroy()
    })

    it('follows the OS preference when the page carries no marker', () => {
      const cursor = createMagnetCursor({ ...LIGHT, dark: DARK })
      const el = cursor.element!

      setPrefersDark(true)
      expect(cssVar(el, '--mc-color')).toBe(DARK.color)

      setPrefersDark(false)
      expect(cssVar(el, '--mc-color')).toBe(LIGHT.color)

      cursor.destroy()
    })

    it('ignores the page when the theme is controlled', async () => {
      const cursor = createMagnetCursor({ ...LIGHT, dark: DARK, theme: 'dark' })
      const el = cursor.element!

      expect(cssVar(el, '--mc-color')).toBe(DARK.color)

      // Page says light, but the caller asked for dark and keeps it.
      document.documentElement.setAttribute('data-theme', 'light')
      await flush()
      expect(cssVar(el, '--mc-color')).toBe(DARK.color)

      cursor.destroy()
    })

    it('switches palette when setOptions changes the theme', () => {
      const cursor = createMagnetCursor({ ...LIGHT, dark: DARK, theme: 'light' })
      const el = cursor.element!
      expect(cssVar(el, '--mc-color')).toBe(LIGHT.color)

      cursor.setOptions({ theme: 'dark' })
      expect(cssVar(el, '--mc-color')).toBe(DARK.color)

      cursor.setOptions({ theme: 'light' })
      expect(cssVar(el, '--mc-color')).toBe(LIGHT.color)

      cursor.destroy()
    })

    it('honours a custom dark selector', async () => {
      const cursor = createMagnetCursor({
        ...LIGHT,
        dark: DARK,
        darkSelector: '[data-mode="night"]',
      })
      const el = cursor.element!

      document.documentElement.classList.add('dark')
      await flush()
      // The default marker is not the configured one, so nothing changes.
      expect(cssVar(el, '--mc-color')).toBe(LIGHT.color)

      document.documentElement.setAttribute('data-mode', 'night')
      await flush()
      expect(cssVar(el, '--mc-color')).toBe(DARK.color)

      document.documentElement.removeAttribute('data-mode')
      cursor.destroy()
    })

    it('tints the merged shape from the dark palette', async () => {
      const cursor = createMagnetCursor({
        ...LIGHT,
        morph: { color: '#111111' },
        dark: { morphColor: '#eeeeee' },
      })
      const morphEl = cursor.element!.querySelector<HTMLElement>('.magnet-cursor__morph')!
      expect(morphEl.style.getPropertyValue('--mc-morph-color')).toBe('#111111')

      document.documentElement.classList.add('dark')
      await flush()
      expect(morphEl.style.getPropertyValue('--mc-morph-color')).toBe('#eeeeee')

      cursor.destroy()
    })

    it('lets the dark palette clear the morph tint back to itemColor', async () => {
      const cursor = createMagnetCursor({
        ...LIGHT,
        morph: { color: '#111111' },
        dark: { morphColor: null },
      })
      const morphEl = cursor.element!.querySelector<HTMLElement>('.magnet-cursor__morph')!

      document.documentElement.classList.add('dark')
      await flush()
      // Cleared rather than set: the stylesheet then falls back to --mc-item-color.
      expect(morphEl.style.getPropertyValue('--mc-morph-color')).toBe('')

      cursor.destroy()
    })

    it('stops watching the page once destroyed', async () => {
      const cursor = createMagnetCursor({ ...LIGHT, dark: DARK })
      const el = cursor.element!
      cursor.destroy()

      expect(mediaListeners).toHaveLength(0)
      document.documentElement.classList.add('dark')
      await flush()
      expect(cssVar(el, '--mc-color')).toBe(LIGHT.color)
    })
  })
})
