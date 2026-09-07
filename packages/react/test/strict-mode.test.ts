import { StrictMode, createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GravitationalLiquid } from '../src/GravitationalLiquid'
import { Magnet } from '../src/Magnet'

const BASE = { detectPointer: false, respectReducedMotion: false } as const

let host: HTMLDivElement
let root: Root

/** jsdom has no layout: a 200x100 element positioned at (100, 100). */
const stubLayout = (el: Element) => {
  el.getBoundingClientRect = () =>
    ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }) as DOMRect
}

const renderStrict = (element: ReturnType<typeof createElement>) => {
  act(() => {
    root.render(createElement(StrictMode, null, element))
  })
}

/**
 * StrictMode double-invokes effects — mount, clean up, mount again — but on
 * React 18 it attaches a stable callback ref only once. An effect creating the
 * instance survives that; an effect that only *destroys* one created inside the
 * ref does not, and the element is left inert with no way to notice.
 *
 * These two are the regression guard for that: both run on whichever React the
 * workspace has installed, and both fail if creation and teardown ever drift
 * back onto different lifecycles.
 */
describe('StrictMode', () => {
  beforeEach(() => {
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

  it('leaves a magnet live after the double mount', () => {
    renderStrict(
      createElement(
        Magnet,
        { ...BASE, as: 'button', target: '.dot', strength: 0.5 },
        createElement('span', { className: 'dot' }),
      ),
    )

    const button = host.querySelector('button')!
    stubLayout(button)

    act(() => {
      button.dispatchEvent(new MouseEvent('mouseenter', { clientX: 300, clientY: 200 }))
      button.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 200 }))
    })

    expect(host.querySelector<HTMLElement>('.dot')!.style.transform).toBe(
      'translate3d(50px, 25px, 0)',
    )
  })

  it('leaves a gravitational liquid surface painted after the double mount', () => {
    renderStrict(
      createElement(GravitationalLiquid, { ...BASE, as: 'button', surface: '#111' }, 'Hover me'),
    )

    const button = host.querySelector('button')!
    // The surface is the whole effect: no SVG means the instance was destroyed
    // by the StrictMode cleanup and never rebuilt.
    expect(button.querySelector('svg')).not.toBeNull()
    expect(button.style.backgroundColor).toBe('transparent')
  })

  it('tears both down for real on unmount', () => {
    renderStrict(
      createElement(GravitationalLiquid, { ...BASE, as: 'button', surface: '#111' }, 'Hover me'),
    )
    expect(host.querySelector('svg')).not.toBeNull()

    act(() => root.render(null))
    expect(host.querySelector('svg')).toBeNull()
  })
})
