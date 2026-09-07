import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Magnet } from '../src/Magnet'

const BASE = { detectPointer: false, respectReducedMotion: false } as const

let host: HTMLDivElement
let root: Root

/** jsdom has no layout: a 200x100 hover area positioned at (100, 100). */
const stubLayout = (el: Element) => {
  el.getBoundingClientRect = () =>
    ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }) as DOMRect
}

const render = (element: ReturnType<typeof createElement>) => {
  act(() => {
    root.render(element)
  })
}

const hover = (el: Element, clientX: number, clientY: number) => {
  act(() => {
    el.dispatchEvent(new MouseEvent('mouseenter', { clientX, clientY }))
    el.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }))
  })
}

describe('<Magnet>', () => {
  beforeEach(() => {
    // The shared frame batcher runs through rAF; make it synchronous.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

    host = document.createElement('div')
    document.body.appendChild(host)
    act(() => {
      root = createRoot(host)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  it('reads `target` as the magnet target and keeps it off the DOM', () => {
    render(
      createElement(
        Magnet,
        { ...BASE, as: 'a', href: '#', target: '.dot', strength: 0.5 },
        createElement('span', { className: 'dot' }),
      ),
    )

    const anchor = host.querySelector('a')!
    stubLayout(anchor)
    expect(anchor.hasAttribute('target')).toBe(false)

    hover(anchor, 300, 200)
    expect(host.querySelector<HTMLElement>('.dot')!.style.transform).toBe(
      'translate3d(50px, 25px, 0)',
    )
    expect(anchor.style.transform).toBe('')
  })

  it('hands `target` back to the element when `magnetTarget` names the magnet', () => {
    render(
      createElement(
        Magnet,
        {
          ...BASE,
          as: 'a',
          href: 'https://example.com',
          target: '_blank',
          rel: 'noreferrer',
          magnetTarget: '.dot',
          strength: 0.5,
        },
        createElement('span', { className: 'dot' }),
      ),
    )

    const anchor = host.querySelector('a')!
    stubLayout(anchor)

    // The whole point: an external link stays external.
    expect(anchor.getAttribute('target')).toBe('_blank')
    expect(anchor.getAttribute('rel')).toBe('noreferrer')

    // ...and the magnet still moves the element `magnetTarget` names.
    hover(anchor, 300, 200)
    expect(host.querySelector<HTMLElement>('.dot')!.style.transform).toBe(
      'translate3d(50px, 25px, 0)',
    )
    expect(anchor.style.transform).toBe('')
  })
})
