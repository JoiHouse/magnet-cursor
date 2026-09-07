import { StrictMode, createElement, useState } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MagnetCursorInstance, MagnetCursorOptions } from '@joihouse/magnet-cursor-core'

/**
 * The engine is mocked: these tests are about the React lifecycle around it —
 * when the instance is created, when it is destroyed, when `setOptions` is
 * pushed — not about what the cursor draws. `cursor.test.ts` in the core
 * package covers that.
 */
const engine = vi.hoisted(() => {
  const instances: Array<{
    setOptions: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }> = []
  const createMagnetCursor = vi.fn((_options?: unknown) => {
    const instance = { setOptions: vi.fn(), destroy: vi.fn() }
    instances.push(instance)
    return instance
  })
  return { instances, createMagnetCursor }
})

vi.mock('@joihouse/magnet-cursor-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@joihouse/magnet-cursor-core')>()),
  createMagnetCursor: engine.createMagnetCursor,
}))

const { MagnetCursor } = await import('../src/MagnetCursor')
const { useMagnetCursor } = await import('../src/useMagnetCursor')

let host: HTMLDivElement
let root: Root

const render = (element: ReturnType<typeof createElement>, strict = false) => {
  act(() => {
    root.render(strict ? createElement(StrictMode, null, element) : element)
  })
}

/** The options object the engine was handed on the n-th creation. */
const createdWith = (n: number): MagnetCursorOptions =>
  engine.createMagnetCursor.mock.calls[n]![0] as MagnetCursorOptions

describe('useMagnetCursor', () => {
  beforeEach(() => {
    engine.instances.length = 0
    engine.createMagnetCursor.mockClear()
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

  it('creates on mount, destroys on unmount, and returns the live instance', () => {
    let seen: MagnetCursorInstance | null | undefined
    const Probe = () => {
      seen = useMagnetCursor({ color: '#000' })
      return null
    }

    render(createElement(Probe))
    expect(engine.createMagnetCursor).toHaveBeenCalledTimes(1)
    expect(createdWith(0).color).toBe('#000')
    // The instance is surfaced through state so the component re-renders with it.
    expect(seen).toBe(engine.instances[0])

    act(() => root.render(null))
    expect(engine.instances[0]!.destroy).toHaveBeenCalledTimes(1)
  })

  it('survives the StrictMode double mount with exactly one live instance', () => {
    render(createElement(MagnetCursor, { color: '#000' }), true)

    // Mount, cleanup, mount again: two creations, the first destroyed.
    expect(engine.createMagnetCursor).toHaveBeenCalledTimes(2)
    expect(engine.instances[0]!.destroy).toHaveBeenCalledTimes(1)
    expect(engine.instances[1]!.destroy).not.toHaveBeenCalled()

    act(() => root.render(null))
    expect(engine.instances[1]!.destroy).toHaveBeenCalledTimes(1)
  })

  it('pushes changed options through setOptions instead of rebuilding', () => {
    let setColor: (color: string) => void = () => {}
    const Probe = () => {
      const [color, set] = useState('#000')
      setColor = set
      // Inline object: a new identity on every render, which must not matter.
      useMagnetCursor({ color, lerp: 0.2 })
      return null
    }

    render(createElement(Probe))
    const instance = engine.instances[0]!
    // The signature effect also runs once on mount; count from there.
    const pushed = instance.setOptions.mock.calls.length

    act(() => setColor('#fff'))
    expect(engine.createMagnetCursor).toHaveBeenCalledTimes(1)
    expect(instance.setOptions).toHaveBeenCalledTimes(pushed + 1)
    expect(instance.setOptions).toHaveBeenLastCalledWith({ color: '#fff', lerp: 0.2 })

    // Same values, new object: nothing to push.
    act(() => setColor('#fff'))
    expect(instance.setOptions).toHaveBeenCalledTimes(pushed + 1)
  })

  it('never hands a callback to setOptions', () => {
    let bump: () => void = () => {}
    const Probe = () => {
      const [n, set] = useState(0)
      bump = () => set((v) => v + 1)
      useMagnetCursor({ scale: n, onItemChange: () => {} })
      return null
    }

    render(createElement(Probe))
    act(() => bump())

    const instance = engine.instances[0]!
    expect(instance.setOptions.mock.calls.length).toBeGreaterThan(0)
    for (const [options] of instance.setOptions.mock.calls) {
      expect(options).not.toHaveProperty('onItemChange')
    }
  })

  it('routes onItemChange to the newest callback without recreating', () => {
    const first = vi.fn()
    const second = vi.fn()
    let swap: () => void = () => {}
    const Probe = () => {
      const [cb, set] = useState(() => first)
      swap = () => set(() => second)
      useMagnetCursor({ onItemChange: cb })
      return null
    }

    render(createElement(Probe))
    const target = document.createElement('button')
    createdWith(0).onItemChange!(true, target)
    expect(first).toHaveBeenCalledWith(true, target)

    act(() => swap())
    expect(engine.createMagnetCursor).toHaveBeenCalledTimes(1)
    // The engine still holds the proxy it was given at creation...
    createdWith(0).onItemChange!(false, null)
    // ...and the proxy reaches the callback from the latest render.
    expect(second).toHaveBeenCalledWith(false, null)
    expect(first).toHaveBeenCalledTimes(1)
  })
})

describe('<MagnetCursor> under SSR', () => {
  it('renders nothing and never touches the engine', () => {
    engine.createMagnetCursor.mockClear()
    const html = renderToString(
      createElement(MagnetCursor, { color: '#000', hideNativeCursor: true }),
    )
    expect(html).toBe('')
    expect(engine.createMagnetCursor).not.toHaveBeenCalled()
  })
})
