import { KeepAlive, createApp, defineComponent, h, nextTick, reactive } from 'vue'
import type { App } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MagnetCursorOptions } from '@joihouse/magnet-cursor-core'

/**
 * The engine is mocked: this is about the Vue lifecycle around it — creation
 * in `onMounted`, options forwarded through `setOptions`, teardown with the
 * scope — not about what the cursor draws.
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
let app: App | null = null

const createdWith = (n: number): MagnetCursorOptions =>
  engine.createMagnetCursor.mock.calls[n]![0] as MagnetCursorOptions

beforeEach(() => {
  engine.instances.length = 0
  engine.createMagnetCursor.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
})

afterEach(() => {
  app?.unmount()
  app = null
  host.remove()
})

describe('<MagnetCursor>', () => {
  it('creates once with only the props that were set, plus the emit proxy', () => {
    app = createApp({ render: () => h(MagnetCursor, { color: '#000', hideNativeCursor: true }) })
    app.mount(host)

    expect(engine.createMagnetCursor).toHaveBeenCalledTimes(1)
    const options = createdWith(0)
    expect(options.color).toBe('#000')
    expect(options.hideNativeCursor).toBe(true)
    expect(typeof options.onItemChange).toBe('function')
    // Unset props are left out so they cannot shadow the engine defaults.
    expect(options).not.toHaveProperty('lerp')
    expect(options).not.toHaveProperty('detectPointer')
    // Renderless: nothing lands in the DOM.
    expect(host.innerHTML).toBe('<!---->')
  })

  it('forwards prop changes through setOptions instead of rebuilding', async () => {
    const state = reactive({ color: '#000' })
    app = createApp({ render: () => h(MagnetCursor, { color: state.color }) })
    app.mount(host)
    const instance = engine.instances[0]!

    state.color = '#fff'
    await nextTick()

    expect(engine.createMagnetCursor).toHaveBeenCalledTimes(1)
    expect(instance.setOptions).toHaveBeenCalledTimes(1)
    expect(instance.setOptions.mock.calls[0]![0]).toMatchObject({ color: '#fff' })
  })

  it('emits itemChange when the engine reports one', () => {
    const onItemChange = vi.fn()
    app = createApp({ render: () => h(MagnetCursor, { onItemChange }) })
    app.mount(host)

    const target = document.createElement('a')
    createdWith(0).onItemChange!(true, target)
    expect(onItemChange).toHaveBeenCalledWith(true, target)
  })

  it('destroys on unmount', () => {
    app = createApp({ render: () => h(MagnetCursor) })
    app.mount(host)
    app.unmount()
    app = null
    expect(engine.instances[0]!.destroy).toHaveBeenCalledTimes(1)
  })

  it('renders on the server without touching the engine', async () => {
    const html = await renderToString(
      createApp({ render: () => h(MagnetCursor, { color: '#000' }) }),
    )
    expect(html).toBe('<!---->')
    expect(engine.createMagnetCursor).not.toHaveBeenCalled()
  })
})

describe('useMagnetCursor', () => {
  it('exposes the live instance and stop() tears it down early', async () => {
    let api: ReturnType<typeof useMagnetCursor> | undefined
    app = createApp({
      setup() {
        api = useMagnetCursor({ color: '#000' })
        return () => null
      },
    })
    app.mount(host)

    expect(api!.instance.value).toBe(engine.instances[0])
    api!.stop()
    expect(engine.instances[0]!.destroy).toHaveBeenCalledTimes(1)
    expect(api!.instance.value).toBeNull()

    // Scope disposal must not destroy a second time.
    app.unmount()
    app = null
    expect(engine.instances[0]!.destroy).toHaveBeenCalledTimes(1)
  })

  it('keeps the instance alive while a <KeepAlive> page is deactivated', async () => {
    const Page = defineComponent({
      name: 'Page',
      setup() {
        useMagnetCursor()
        return () => h('p', 'page')
      },
    })
    const state = reactive({ show: true })
    app = createApp({
      render: () => h(KeepAlive, null, { default: () => (state.show ? h(Page) : undefined) }),
    })
    app.mount(host)
    expect(engine.createMagnetCursor).toHaveBeenCalledTimes(1)

    // Deactivated, not unmounted: the scope lives on, so does the cursor. The
    // page owns it and gets the same one back when it returns.
    state.show = false
    await nextTick()
    expect(engine.instances[0]!.destroy).not.toHaveBeenCalled()

    state.show = true
    await nextTick()
    expect(engine.createMagnetCursor).toHaveBeenCalledTimes(1)

    // Dropping the cache is what finally disposes the scope.
    app.unmount()
    app = null
    expect(engine.instances[0]!.destroy).toHaveBeenCalledTimes(1)
  })
})
