import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMagnet } from '../src/magnet'

const BASE = { detectPointer: false, respectReducedMotion: false } as const

/** Run scheduled frames synchronously so assertions do not need timers. */
const runFramesSynchronously = () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
}

/**
 * Replace the trigger's rect reader and its target's transform setter with
 * spies that append to `order`, so a test can assert the read/write phasing of
 * the shared frame.
 */
const traceLayout = (el: HTMLElement, name: string, order: string[]) => {
  const rect = el.getBoundingClientRect.bind(el)
  el.getBoundingClientRect = () => {
    order.push(`read:${name}`)
    return rect()
  }

  let transform = ''
  Object.defineProperty(el.style, 'transform', {
    configurable: true,
    get: () => transform,
    set: (value: string) => {
      order.push(`write:${name}`)
      transform = value
    },
  })
}

const mountTrigger = () => {
  const el = document.createElement('div')
  // jsdom has no layout: 200x100 box positioned at (100, 100).
  el.getBoundingClientRect = () =>
    ({
      left: 100,
      top: 100,
      width: 200,
      height: 100,
      right: 300,
      bottom: 200,
      x: 100,
      y: 100,
    }) as DOMRect
  document.body.appendChild(el)
  return el
}

const hover = (el: HTMLElement, clientX: number, clientY: number) => {
  el.dispatchEvent(new MouseEvent('mouseenter', { clientX, clientY }))
  el.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }))
}

describe('createMagnet', () => {
  beforeEach(runFramesSynchronously)
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('moves the trigger toward the pointer, damped by strength', () => {
    const el = mountTrigger()
    createMagnet(el, { ...BASE, strength: 0.5 })

    // Centre is (200, 150); pointer at (300, 200) => delta (100, 50) * 0.5.
    hover(el, 300, 200)

    expect(el.style.transform).toBe('translate3d(50px, 25px, 0)')
  })

  it('clamps travel to size * clampRatio + padding', () => {
    const el = mountTrigger()
    createMagnet(el, { ...BASE, strength: 1, clampRatio: 0.5, padding: 16 })

    hover(el, 5000, 5000)

    // x: 200 * 0.5 + 16 = 116, y: 100 * 0.5 + 16 = 66
    expect(el.style.transform).toBe('translate3d(116px, 66px, 0)')
  })

  it('honours the axis lock', () => {
    const el = mountTrigger()
    createMagnet(el, { ...BASE, strength: 0.5, axis: 'x' })

    hover(el, 300, 200)

    expect(el.style.transform).toBe('translate3d(50px, 0px, 0)')
  })

  it('transforms a nested target while listening on the trigger', () => {
    const el = mountTrigger()
    const inner = document.createElement('span')
    inner.className = 'inner'
    el.appendChild(inner)

    createMagnet(el, { ...BASE, strength: 0.5, target: '.inner' })
    hover(el, 300, 200)

    expect(inner.style.transform).toBe('translate3d(50px, 25px, 0)')
    expect(el.style.transform).toBe('')
  })

  it('snaps back on mouseleave', () => {
    const el = mountTrigger()
    createMagnet(el, { ...BASE, strength: 0.5 })

    hover(el, 300, 200)
    el.dispatchEvent(new MouseEvent('mouseleave'))

    expect(el.style.transform).toBe('translate3d(0px, 0px, 0)')
    expect(el.style.transition).toContain('transform')
  })

  it('clears styles and stops responding after destroy', () => {
    const el = mountTrigger()
    const magnet = createMagnet(el, { ...BASE, strength: 0.5 })

    hover(el, 300, 200)
    magnet.destroy()

    expect(el.style.transform).toBe('')
    hover(el, 400, 300)
    expect(el.style.transform).toBe('')
  })

  it('runs every layout read before any write in the shared frame', () => {
    let batch: FrameRequestCallback | null = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      batch = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const order: string[] = []
    const outer = mountTrigger()
    const inner = mountTrigger()
    outer.appendChild(inner)
    traceLayout(outer, 'outer', order)
    traceLayout(inner, 'inner', order)

    createMagnet(outer, { ...BASE, strength: 0.5 })
    createMagnet(inner, { ...BASE, strength: 0.5 })

    // One pointer gesture over the nested pair schedules both magnets.
    hover(outer, 300, 200)
    hover(inner, 300, 200)
    expect(order).toEqual([])

    batch!(0)
    expect(order).toEqual(['read:outer', 'read:inner', 'write:outer', 'write:inner'])
  })

  it('coalesces repeated moves into a single frame', () => {
    let batch: FrameRequestCallback | null = null
    let requested = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      requested += 1
      batch = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const order: string[] = []
    const el = mountTrigger()
    traceLayout(el, 'el', order)
    createMagnet(el, { ...BASE, strength: 0.5 })

    hover(el, 300, 200)
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 310, clientY: 210 }))
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: 320, clientY: 220 }))
    expect(requested).toBe(1)

    batch!(0)
    expect(order).toEqual(['read:el', 'write:el'])
  })

  it('is a no-op instance when disabled by pointer detection', () => {
    const el = mountTrigger()
    // jsdom exposes no matchMedia, so pointer detection resolves to "not a mouse".
    const magnet = createMagnet(el, { detectPointer: true })

    expect(magnet.enabled).toBe(false)
    hover(el, 300, 200)
    expect(el.style.transform).toBe('')
  })
})
