import { createApp, h, nextTick } from 'vue'
import type { App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Magnet } from '../src/Magnet'

const BASE = { detectPointer: false, respectReducedMotion: false } as const

let host: HTMLDivElement
let app: App | null = null

/** jsdom has no layout: a 200x100 hover area positioned at (100, 100). */
const stubLayout = (el: Element) => {
  el.getBoundingClientRect = () =>
    ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }) as DOMRect
}

/** `useMagnet` binds on a post-flush watcher, so the instance exists a tick later. */
const mount = async (props: Record<string, unknown>) => {
  app = createApp({
    render: () => h(Magnet, props, { default: () => h('span', { class: 'dot' }) }),
  })
  app.mount(host)
  await nextTick()
  return host.querySelector('a')!
}

const hover = (el: Element, clientX: number, clientY: number) => {
  el.dispatchEvent(new MouseEvent('mouseenter', { clientX, clientY }))
  el.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }))
}

describe('<Magnet>', () => {
  beforeEach(() => {
    // The shared frame batcher runs through rAF; make it synchronous.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    app?.unmount()
    app = null
    host.remove()
    vi.unstubAllGlobals()
  })

  it('reads `target` as the magnet target and keeps it off the DOM', async () => {
    const anchor = await mount({ ...BASE, as: 'a', href: '#', target: '.dot', strength: 0.5 })
    stubLayout(anchor)

    expect(anchor.hasAttribute('target')).toBe(false)

    hover(anchor, 300, 200)
    expect(host.querySelector<HTMLElement>('.dot')!.style.transform).toBe(
      'translate3d(50px, 25px, 0)',
    )
    expect(anchor.style.transform).toBe('')
  })

  it('hands `target` back to the element when `magnetTarget` names the magnet', async () => {
    const anchor = await mount({
      ...BASE,
      as: 'a',
      href: 'https://example.com',
      target: '_blank',
      rel: 'noreferrer',
      magnetTarget: '.dot',
      strength: 0.5,
    })
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
