import { createApp, h, nextTick, reactive, withDirectives } from 'vue'
import type { App } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Both directives share one shape — create in `mounted`, `setOptions` in
 * `updated` when the value changed, `destroy` in `unmounted` — so both engines
 * are mocked and the same three lifecycles are pinned for each.
 */
const engine = vi.hoisted(() => {
  const make = () => {
    const instances: Array<{
      setOptions: ReturnType<typeof vi.fn>
      destroy: ReturnType<typeof vi.fn>
    }> = []
    const create = vi.fn((_el: HTMLElement, _options?: unknown) => {
      const instance = { setOptions: vi.fn(), destroy: vi.fn() }
      instances.push(instance)
      return instance
    })
    return { instances, create }
  }
  return { magnet: make(), liquid: make() }
})

// Both directives import from the core root entry — never a subpath, since
// the subpaths are ESM-only and the CJS bundle has to resolve too — so the
// root is the one module to mock.
vi.mock('@joihouse/magnet-cursor-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@joihouse/magnet-cursor-core')>()),
  createMagnet: engine.magnet.create,
  createGravitationalLiquid: engine.liquid.create,
}))

const { vMagnet } = await import('../src/directive')
const { vGravitationalLiquid } = await import('../src/liquid-directive')

let host: HTMLDivElement
let app: App | null = null

const cases = [
  { name: 'v-magnet', directive: vMagnet, engine: engine.magnet },
  { name: 'v-gravitational-liquid', directive: vGravitationalLiquid, engine: engine.liquid },
] as const

describe.each(cases)('$name', ({ directive, engine: fake }) => {
  beforeEach(() => {
    fake.instances.length = 0
    fake.create.mockClear()
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    app?.unmount()
    app = null
    host.remove()
  })

  /** Mounts a button carrying the directive with a reactive value. */
  const mount = (state: { value: Record<string, unknown> | undefined; tick: number }) => {
    app = createApp({
      render: () =>
        withDirectives(h('button', { 'data-tick': state.tick }, 'Hover me'), [
          [directive, state.value],
        ]),
    })
    app.mount(host)
    return host.querySelector('button')!
  }

  it('creates on the element with the bound value, or empty options when unbound', () => {
    const button = mount(reactive({ value: undefined, tick: 0 }))
    expect(fake.create).toHaveBeenCalledTimes(1)
    expect(fake.create.mock.calls[0]![0]).toBe(button)
    expect(fake.create.mock.calls[0]![1]).toEqual({})
  })

  it('pushes a new value through setOptions and skips unchanged ones', async () => {
    const state = reactive<{ value: Record<string, unknown> | undefined; tick: number }>({
      value: { strength: 0.4 },
      tick: 0,
    })
    mount(state)
    const instance = fake.instances[0]!

    // Re-render for an unrelated reason: same value object, nothing to push.
    state.tick += 1
    await nextTick()
    expect(instance.setOptions).not.toHaveBeenCalled()

    state.value = { strength: 0.8 }
    await nextTick()
    expect(instance.setOptions).toHaveBeenCalledTimes(1)
    expect(instance.setOptions).toHaveBeenCalledWith({ strength: 0.8 })
    expect(fake.create).toHaveBeenCalledTimes(1)
  })

  it('destroys on unmount', () => {
    mount(reactive({ value: undefined, tick: 0 }))
    app!.unmount()
    app = null
    expect(fake.instances[0]!.destroy).toHaveBeenCalledTimes(1)
  })

  it('renders on the server without a warning and without touching the engine', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const html = await renderToString(
      createApp({
        render: () => withDirectives(h('button', 'Hover me'), [[directive, { strength: 0.4 }]]),
      }),
    )
    expect(html).toBe('<button>Hover me</button>')
    expect(fake.create).not.toHaveBeenCalled()
    // `getSSRProps` is what keeps the renderer quiet about a client-only directive.
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
