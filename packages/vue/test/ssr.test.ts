// @vitest-environment node
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { Magnet } from '../src/Magnet'
import { useGravitationalLiquid } from '../src/useGravitationalLiquid'
import { useMagnet } from '../src/useMagnet'
import { resolveElement } from '../src/element'

/**
 * Server rendering, on real Node: no `window`, no `document`, no `HTMLElement`.
 *
 * The composables bind through an immediate watcher, and Vue does run those
 * during SSR `setup()`. A template ref is still null on the server, but a
 * getter can return a live object, and `resolveElement` used to reach
 * `instanceof HTMLElement` and throw a ReferenceError there.
 */
const render = (setup: () => () => ReturnType<typeof h>) =>
  renderToString(createSSRApp(defineComponent({ setup })))

describe('server rendering', () => {
  it('has no DOM to resolve against', () => {
    expect(typeof HTMLElement).toBe('undefined')
    expect(resolveElement(() => ({ $el: {} }))).toBeNull()
  })

  it('renders a component wrapped in <Magnet>', async () => {
    const html = await render(() => () => h(Magnet, {}, { default: () => h('span', 'go') }))
    expect(html).toContain('go')
  })

  it('renders when the composable is given a template ref', async () => {
    const html = await render(() => {
      const el = ref<HTMLElement | null>(null)
      useMagnet(el)
      return () => h('button', { ref: el }, 'go')
    })
    expect(html).toBe('<button>go</button>')
  })

  it('renders when the composable is given a live object', async () => {
    const html = await render(() => {
      useMagnet(() => ({ $el: {} }))
      useGravitationalLiquid(() => ({ $el: {} }))
      return () => h('div', 'ok')
    })
    expect(html).toBe('<div>ok</div>')
  })
})
