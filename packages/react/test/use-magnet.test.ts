import { createElement, useState } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MagnetOptions, MagnetState } from '@joihouse/magnet-cursor-core'

/**
 * `<Magnet>` is exercised against the real engine in `magnet.test.ts` and
 * `strict-mode.test.ts`. This file mocks the engine to pin the hook's own
 * contract: one instance per element, options pushed in place, callbacks
 * proxied to the latest render.
 */
const engine = vi.hoisted(() => {
  const instances: Array<{
    setOptions: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    reset: ReturnType<typeof vi.fn>
  }> = []
  const createMagnet = vi.fn((_el: HTMLElement, _options?: unknown) => {
    const instance = { setOptions: vi.fn(), destroy: vi.fn(), reset: vi.fn() }
    instances.push(instance)
    return instance
  })
  return { instances, createMagnet }
})

vi.mock('@joihouse/magnet-cursor-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@joihouse/magnet-cursor-core')>()),
  createMagnet: engine.createMagnet,
}))

const { useMagnet } = await import('../src/useMagnet')

let host: HTMLDivElement
let root: Root

const createdWith = (n: number): MagnetOptions =>
  engine.createMagnet.mock.calls[n]![1] as MagnetOptions

describe('useMagnet', () => {
  beforeEach(() => {
    engine.instances.length = 0
    engine.createMagnet.mockClear()
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
  })

  it('binds to the element the callback ref receives and tears down on unmount', () => {
    const Probe = () => {
      const { ref } = useMagnet<HTMLButtonElement>({ strength: 0.4 })
      return createElement('button', { ref }, 'Hover me')
    }

    render(createElement(Probe))
    const button = host.querySelector('button')!
    expect(engine.createMagnet).toHaveBeenCalledTimes(1)
    expect(engine.createMagnet.mock.calls[0]![0]).toBe(button)
    expect(createdWith(0).strength).toBe(0.4)

    act(() => root.render(null))
    expect(engine.instances[0]!.destroy).toHaveBeenCalledTimes(1)
  })

  it('pushes option changes in place and ignores identity-only changes', () => {
    let setStrength: (v: number) => void = () => {}
    const Probe = () => {
      const [strength, set] = useState(0.4)
      setStrength = set
      const { ref } = useMagnet({ strength, onEnter: () => {} })
      return createElement('button', { ref })
    }

    render(createElement(Probe))
    const instance = engine.instances[0]!
    const pushed = instance.setOptions.mock.calls.length

    act(() => setStrength(0.8))
    expect(engine.createMagnet).toHaveBeenCalledTimes(1)
    expect(instance.setOptions).toHaveBeenCalledTimes(pushed + 1)
    // Callbacks stay behind: the engine keeps the proxies it was created with.
    expect(instance.setOptions).toHaveBeenLastCalledWith({ strength: 0.8 })

    act(() => setStrength(0.8))
    expect(instance.setOptions).toHaveBeenCalledTimes(pushed + 1)
  })

  it('proxies onEnter / onMove / onLeave to the callbacks of the latest render', () => {
    const first = { onEnter: vi.fn(), onMove: vi.fn(), onLeave: vi.fn() }
    const second = { onEnter: vi.fn(), onMove: vi.fn(), onLeave: vi.fn() }
    let swap: () => void = () => {}
    const Probe = () => {
      const [handlers, set] = useState(first)
      swap = () => set(second)
      const { ref } = useMagnet(handlers)
      return createElement('button', { ref })
    }

    render(createElement(Probe))
    act(() => swap())
    expect(engine.createMagnet).toHaveBeenCalledTimes(1)

    const state = { x: 1, y: 2 } as unknown as MagnetState
    const given = createdWith(0)
    given.onEnter!(state)
    given.onMove!(state)
    given.onLeave!()

    expect(second.onEnter).toHaveBeenCalledWith(state)
    expect(second.onMove).toHaveBeenCalledWith(state)
    expect(second.onLeave).toHaveBeenCalledTimes(1)
    expect(first.onEnter).not.toHaveBeenCalled()
    expect(first.onMove).not.toHaveBeenCalled()
    expect(first.onLeave).not.toHaveBeenCalled()
  })

  it('exposes reset and the live instance', () => {
    let api: ReturnType<typeof useMagnet> | undefined
    const Probe = () => {
      api = useMagnet()
      return createElement('button', { ref: api.ref })
    }

    render(createElement(Probe))
    expect(api!.instanceRef.current).toBe(engine.instances[0])
    api!.reset()
    expect(engine.instances[0]!.reset).toHaveBeenCalledTimes(1)
  })

  it('rebuilds when the ref moves to another element', () => {
    let flip: () => void = () => {}
    const Probe = () => {
      const [alt, set] = useState(false)
      flip = () => set(true)
      const { ref } = useMagnet()
      // A different key forces a fresh DOM node, which is what a conditional
      // render or a list re-key does in real code.
      return createElement('button', { key: alt ? 'b' : 'a', ref })
    }

    render(createElement(Probe))
    act(() => flip())

    expect(engine.createMagnet).toHaveBeenCalledTimes(2)
    expect(engine.instances[0]!.destroy).toHaveBeenCalledTimes(1)
    expect(engine.instances[1]!.destroy).not.toHaveBeenCalled()
    expect(engine.createMagnet.mock.calls[1]![0]).toBe(host.querySelector('button'))
  })
})

function render(element: ReturnType<typeof createElement>) {
  act(() => {
    root.render(element)
  })
}
