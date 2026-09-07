import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DARK_SELECTOR,
  DEFAULT_LIGHT_SELECTOR,
  createThemeWatcher,
  detectTheme,
} from '../src/theme'
import type { ResolvedTheme } from '../src/theme'

/**
 * jsdom ships no `matchMedia`, so the OS-preference branch has to be stubbed.
 * The listeners are kept so a test can flip the preference and fire them, the
 * way a real browser does when the OS theme changes.
 */
type Listener = () => void
let mediaListeners: Listener[] = []
let prefersDark = false

const stubMatchMedia = () => {
  mediaListeners = []
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('prefers-color-scheme: dark') ? prefersDark : false
    },
    media: query,
    addEventListener: (_: string, cb: Listener) => mediaListeners.push(cb),
    removeEventListener: (_: string, cb: Listener) => {
      mediaListeners = mediaListeners.filter((l) => l !== cb)
    },
  }))
}

const setPrefersDark = (value: boolean) => {
  prefersDark = value
  for (const cb of [...mediaListeners]) cb()
}

/** `MutationObserver` in jsdom is async; the watcher's callback lands in a microtask. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const SELECTORS = {
  darkSelector: DEFAULT_DARK_SELECTOR,
  lightSelector: DEFAULT_LIGHT_SELECTOR,
}

describe('detectTheme', () => {
  beforeEach(() => {
    prefersDark = false
    stubMatchMedia()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    document.body.className = ''
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-mode')
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    document.body.className = ''
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-mode')
    document.body.innerHTML = ''
  })

  it('defaults to light when the page says nothing', () => {
    expect(detectTheme()).toBe('light')
  })

  it('reads the Tailwind class strategy', () => {
    document.documentElement.classList.add('dark')
    expect(detectTheme()).toBe('dark')
  })

  it('reads the data-theme attribute', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    expect(detectTheme()).toBe('dark')
  })

  it('reads a marker off <body>', () => {
    document.body.classList.add('dark')
    expect(detectTheme()).toBe('dark')
    document.body.classList.remove('dark')
  })

  it('ignores a locally dark panel deep in the page', () => {
    // A dark card in the middle of a light page is not a dark page, and must
    // not repaint a cursor that belongs to the whole document.
    document.body.innerHTML = '<section data-theme="dark">a dark card</section>'
    expect(detectTheme()).toBe('light')
  })

  it('reads the marker off a named app wrapper', () => {
    document.body.innerHTML = '<div class="app dark"></div>'
    expect(detectTheme(DEFAULT_DARK_SELECTOR, DEFAULT_LIGHT_SELECTOR, '.app')).toBe('dark')
  })

  it('falls through when the named wrapper is not on the page yet', () => {
    expect(detectTheme(DEFAULT_DARK_SELECTOR, DEFAULT_LIGHT_SELECTOR, '.missing')).toBe('light')
  })

  it('lets an explicit light marker outrank the OS preference', () => {
    setPrefersDark(true)
    document.documentElement.setAttribute('data-theme', 'light')
    expect(detectTheme()).toBe('light')
  })

  it('prefers a dark marker over an explicit light one', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    document.body.classList.add('dark')
    expect(detectTheme()).toBe('dark')
    document.body.classList.remove('dark')
  })

  it('falls back to the root color-scheme', () => {
    document.documentElement.style.colorScheme = 'dark'
    expect(detectTheme()).toBe('dark')
  })

  it('ignores a dual color-scheme, which declares support rather than a choice', () => {
    document.documentElement.style.colorScheme = 'light dark'
    setPrefersDark(true)
    expect(detectTheme()).toBe('dark')
  })

  it('falls back to the OS preference', () => {
    setPrefersDark(true)
    expect(detectTheme()).toBe('dark')
  })

  it('honours custom selectors', () => {
    document.body.setAttribute('data-mode', 'night')
    expect(detectTheme('[data-mode="night"]', '[data-mode="day"]')).toBe('dark')
    document.body.removeAttribute('data-mode')
  })

  it('survives an invalid selector', () => {
    expect(() => detectTheme(':::nonsense')).not.toThrow()
    expect(detectTheme(':::nonsense')).toBe('light')
  })
})

describe('createThemeWatcher', () => {
  beforeEach(() => {
    prefersDark = false
    stubMatchMedia()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    document.body.className = ''
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-mode')
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.className = ''
    document.body.className = ''
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-mode')
    document.body.innerHTML = ''
  })

  it('reports the theme at construction without firing onChange', () => {
    document.documentElement.classList.add('dark')
    const onChange = vi.fn()
    const watcher = createThemeWatcher({ mode: 'auto', ...SELECTORS, onChange })

    expect(watcher.theme).toBe('dark')
    expect(onChange).not.toHaveBeenCalled()
    watcher.destroy()
  })

  it('fires when the marker lands on the root', async () => {
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      onChange: (t) => seen.push(t),
    })

    document.documentElement.classList.add('dark')
    await flush()

    expect(seen).toEqual(['dark'])
    expect(watcher.theme).toBe('dark')
    watcher.destroy()
  })

  it('fires when the marker lands on a named app wrapper', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      themeRoot: '#app',
      onChange: (t) => seen.push(t),
    })

    document.getElementById('app')!.classList.add('dark')
    await flush()

    expect(seen).toEqual(['dark'])
    watcher.destroy()
  })

  it('stays quiet when a locally dark panel is added', async () => {
    const onChange = vi.fn()
    const watcher = createThemeWatcher({ mode: 'auto', ...SELECTORS, onChange })

    document.body.innerHTML = '<section data-theme="dark"></section>'
    await flush()

    expect(onChange).not.toHaveBeenCalled()
    watcher.destroy()
  })

  it('fires when the OS preference flips', () => {
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      onChange: (t) => seen.push(t),
    })

    setPrefersDark(true)
    expect(seen).toEqual(['dark'])

    setPrefersDark(false)
    expect(seen).toEqual(['dark', 'light'])
    watcher.destroy()
  })

  it('stays quiet when an unrelated attribute changes', async () => {
    const onChange = vi.fn()
    const watcher = createThemeWatcher({ mode: 'auto', ...SELECTORS, onChange })
    document.body.className = 'a'
    await flush()

    // Apps rewrite class names constantly; only a change of *theme* may notify.
    document.body.className = 'b'
    await flush()

    expect(onChange).not.toHaveBeenCalled()
    watcher.destroy()
  })

  it('does not re-read the page for style writes deep in the document', async () => {
    document.body.innerHTML = '<div><div id="cursor"></div></div>'
    const onChange = vi.fn()
    const watcher = createThemeWatcher({ mode: 'auto', ...SELECTORS, onChange })
    const spy = vi.spyOn(window, 'getComputedStyle')

    // The cursor itself rewrites its inline style on every frame it moves. A
    // marker on <html> or <body> is the only thing a re-read could pick up, so
    // a write anywhere else must not cost one.
    const el = document.getElementById('cursor')!
    el.style.transform = 'translate3d(1px, 2px, 0)'
    el.setAttribute('data-theme', 'dark')
    await flush()

    expect(spy).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    spy.mockRestore()
    watcher.destroy()
  })

  it('keeps watching <body> after the document replaces it', async () => {
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      onChange: (t) => seen.push(t),
    })

    // Hydration and test hosts swap the whole element. An observer bound to the
    // <body> that existed at connect time would be left holding a detached node.
    const fresh = document.createElement('body')
    document.documentElement.replaceChild(fresh, document.body)
    await flush()

    fresh.classList.add('dark')
    await flush()

    expect(seen).toEqual(['dark'])
    watcher.destroy()
  })

  it('picks up a <body> that arrives after it starts', async () => {
    const original = document.body
    document.documentElement.removeChild(original)
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      onChange: (t) => seen.push(t),
    })

    // A script in <head> runs before the body parses.
    document.documentElement.appendChild(original)
    await flush()

    original.classList.add('dark')
    await flush()

    expect(seen).toEqual(['dark'])
    watcher.destroy()
  })

  it('ignores an element the theme root selector matches but is not read from', async () => {
    document.body.innerHTML = '<div class="app"></div><div class="app" id="second"></div>'
    const onChange = vi.fn()
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      themeRoot: '.app',
      onChange,
    })
    const spy = vi.spyOn(window, 'getComputedStyle')

    // The theme is read from the first match alone, so a write to any other
    // match cannot change the answer and must not cost a re-read.
    document.getElementById('second')!.classList.add('dark')
    await flush()

    expect(spy).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    spy.mockRestore()
    watcher.destroy()
  })

  it('keeps watching a named app wrapper that is replaced after mount', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      themeRoot: '#app',
      onChange: (t) => seen.push(t),
    })

    // A framework remount swaps the wrapper for a fresh element.
    document.body.innerHTML = '<div id="app"></div>'
    await flush()
    document.getElementById('app')!.classList.add('dark')
    await flush()

    expect(seen).toEqual(['dark'])
    watcher.destroy()
  })

  it('ignores the page entirely when controlled', () => {
    document.documentElement.classList.add('dark')
    const onChange = vi.fn()
    const watcher = createThemeWatcher({ mode: 'light', ...SELECTORS, onChange })

    expect(watcher.theme).toBe('light')
    setPrefersDark(true)
    expect(onChange).not.toHaveBeenCalled()
    watcher.destroy()
  })

  it('picks the listeners up when update() switches into auto', () => {
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'light',
      ...SELECTORS,
      onChange: (t) => seen.push(t),
    })

    setPrefersDark(true)
    expect(seen).toEqual([])

    watcher.update({ mode: 'auto' })
    expect(seen).toEqual(['dark'])
    expect(watcher.theme).toBe('dark')
    watcher.destroy()
  })

  it('drops the listeners when update() leaves auto', () => {
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      onChange: (t) => seen.push(t),
    })

    watcher.update({ mode: 'light' })
    expect(mediaListeners).toHaveLength(0)

    setPrefersDark(true)
    expect(seen).toEqual([])
    watcher.destroy()
  })

  it('re-evaluates against a new selector', () => {
    document.body.setAttribute('data-mode', 'night')
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      onChange: (t) => seen.push(t),
    })

    expect(watcher.theme).toBe('light')
    watcher.update({ darkSelector: '[data-mode="night"]' })
    expect(seen).toEqual(['dark'])
    watcher.destroy()
    document.body.removeAttribute('data-mode')
  })

  it('re-evaluates against a new theme root', () => {
    document.body.innerHTML = '<div id="app" class="dark"></div>'
    const seen: ResolvedTheme[] = []
    const watcher = createThemeWatcher({
      mode: 'auto',
      ...SELECTORS,
      onChange: (t) => seen.push(t),
    })

    expect(watcher.theme).toBe('light')
    watcher.update({ themeRoot: '#app' })
    expect(seen).toEqual(['dark'])
    watcher.destroy()
  })

  it('stops listening once destroyed', () => {
    const onChange = vi.fn()
    const watcher = createThemeWatcher({ mode: 'auto', ...SELECTORS, onChange })

    watcher.destroy()
    setPrefersDark(true)

    expect(onChange).not.toHaveBeenCalled()
    expect(mediaListeners).toHaveLength(0)
  })
})
