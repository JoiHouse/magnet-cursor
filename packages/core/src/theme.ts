import { isBrowser } from './env'

/**
 * Which palette the cursor paints itself with.
 *
 * `'auto'` follows the page. `'light'` and `'dark'` are fully controlled and
 * ignore every signal below — reach for them when the page's own theme state
 * lives somewhere this module cannot see, such as React state that never
 * reaches the DOM.
 */
export type ThemeMode = 'auto' | 'light' | 'dark'

export type ResolvedTheme = 'light' | 'dark'

/**
 * Elements whose presence means the page is in dark mode.
 *
 * Covers the two conventions in practice: Tailwind's `class` strategy and the
 * `data-theme` attribute used by next-themes, daisyUI and friends.
 */
export const DEFAULT_DARK_SELECTOR = '.dark, [data-theme="dark"]'

/**
 * Elements whose presence means the page is explicitly in light mode.
 *
 * Needed because "no dark marker" is ambiguous: under Tailwind's `class`
 * strategy it means light, but on a page with no theme system at all it means
 * "ask the OS". An explicit light marker settles it, and outranks the OS
 * preference the same way an explicit dark marker does.
 */
export const DEFAULT_LIGHT_SELECTOR = '[data-theme="light"]'

export interface ThemeWatcherOptions {
  mode: ThemeMode
  darkSelector: string
  lightSelector: string
  /** Element the markers are read from. Defaults to `<html>` and `<body>`. */
  themeRoot?: string
  /** Called only when the resolved theme actually flips. */
  onChange: (theme: ResolvedTheme) => void
}

export interface ThemeWatcher {
  /** The theme as of the last evaluation. */
  readonly theme: ResolvedTheme
  /** Re-read the page. Call after the options change. */
  update: (next: Partial<Omit<ThemeWatcherOptions, 'onChange'>>) => void
  destroy: () => void
}

/**
 * Attributes an observer has to watch for these selectors to stay accurate.
 *
 * `class` and `style` are always in — the former carries Tailwind's marker,
 * the latter carries an inline `color-scheme`. Anything else is read out of
 * the selectors themselves, so a caller who switches to `[data-mode="night"]`
 * gets an observer that actually sees `data-mode` change.
 */
const attributeFilter = (...selectors: string[]): string[] => {
  const names = new Set(['class', 'style'])
  for (const selector of selectors) {
    for (const match of selector.matchAll(/\[\s*([\w-]+)/g)) {
      if (match[1]) names.add(match[1])
    }
  }
  return [...names]
}

/**
 * The elements a theme marker is read from.
 *
 * `<html>` and `<body>` by default, because that is where every mainstream
 * theme system puts its marker — and because searching the whole document
 * instead would let any locally dark panel deep in the page claim the page is
 * dark. `themeRoot` names an app wrapper for the apps that mark that instead.
 */
const roots = (themeRoot?: string): Element[] => {
  if (themeRoot) {
    try {
      const found = document.querySelector(themeRoot)
      return found ? [found] : []
    } catch {
      return []
    }
  }
  return document.body ? [document.documentElement, document.body] : [document.documentElement]
}

const matches = (selector: string, themeRoot?: string): boolean => {
  if (!selector) return false
  try {
    return roots(themeRoot).some((el) => el.matches(selector))
  } catch {
    // An invalid selector should not take the cursor down with it.
    return false
  }
}

/**
 * Resolve the page's theme from every signal available, most explicit first.
 *
 * 1. A dark marker on the theme root.
 * 2. A light marker on the theme root.
 * 3. The root's own `color-scheme`, which theme libraries set alongside their
 *    markers and which a plain page can declare on its own.
 * 4. The OS preference.
 */
export const detectTheme = (
  darkSelector = DEFAULT_DARK_SELECTOR,
  lightSelector = DEFAULT_LIGHT_SELECTOR,
  themeRoot?: string,
): ResolvedTheme => {
  if (!isBrowser()) return 'light'

  if (matches(darkSelector, themeRoot)) return 'dark'
  if (matches(lightSelector, themeRoot)) return 'light'

  const scheme = getComputedStyle(document.documentElement).colorScheme
  // `color-scheme: light dark` declares support for both rather than a choice,
  // so only a single-valued declaration counts as an answer.
  if (scheme === 'dark') return 'dark'
  if (scheme === 'light') return 'light'

  if (typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Watch the page's theme.
 *
 * In `'auto'` mode this listens to the OS preference and to attribute changes
 * on the elements a marker is actually read from. Without a `themeRoot` those
 * are `<html>` and `<body>`, and only they are observed: the cursor writes its
 * own inline style every frame it moves, and a document-wide observer fired on
 * every one of those writes for a re-read that never changed anything. A
 * `themeRoot` can be mounted late or replaced by a framework, so that case
 * still watches the whole document, but records from any other element are
 * dropped before the theme is re-read. Either way the observer is filtered down
 * to the attributes the configured selectors can be affected by, and what
 * counts as "an element the theme is read from" is `roots()` itself, so the
 * observer can never disagree with `detectTheme` about which element is the
 * theme root.
 */
export const createThemeWatcher = (options: ThemeWatcherOptions): ThemeWatcher => {
  let { mode, darkSelector, lightSelector, themeRoot } = options
  const { onChange } = options

  const resolve = (): ResolvedTheme =>
    mode === 'auto' ? detectTheme(darkSelector, lightSelector, themeRoot) : mode

  let theme = resolve()
  let media: MediaQueryList | null = null
  let observer: MutationObserver | null = null

  const reevaluate = () => {
    const next = resolve()
    if (next === theme) return
    theme = next
    onChange(theme)
  }

  /** Attributes the observer is watching. Recomputed on every connect. */
  let filter: string[] = []
  /** The `<body>` the observer is bound to; `undefined` before the first bind. */
  let boundBody: HTMLElement | null | undefined

  /**
   * Point the observer at `<html>` and whatever `<body>` is in the document now.
   *
   * `<html>` is watched for child changes as well as attributes, because a
   * `<body>` is not necessarily the one the watcher started with: it arrives
   * after `connect()` on a script in `<head>`, and hydration and test hosts
   * replace it wholesale. Binding to it once would leave the observer holding a
   * node no longer in the document, and a marker written to the live `<body>`
   * would never be seen. A child record on `<html>` is the signal to bind
   * again. It costs nothing to watch for: `<html>` has two children and they
   * change about that often.
   *
   * `observe()` on a node already being observed replaces that node's options
   * rather than adding to them, and a single node's registration cannot be
   * dropped on its own, so a rebind tears the observer down and puts it back.
   */
  const bindRoots = () => {
    if (!observer) return
    const body = document.body
    if (body === boundBody) return
    boundBody = body
    observer.disconnect()
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: filter,
      childList: true,
    })
    if (body) observer.observe(body, { attributes: true, attributeFilter: filter })
  }

  const onMutation = (records: MutationRecord[]) => {
    // Without a `themeRoot` the only child record that can reach here is a
    // `<body>` swap. Rebind before reading, so the read and the next batch of
    // records both land on the `<body>` that is actually in play.
    if (!themeRoot && records.some((record) => record.type === 'childList')) {
      bindRoots()
      reevaluate()
      return
    }

    // A record matters exactly when it landed on an element `detectTheme` will
    // read, which is what `roots()` answers — resolved once per batch, not once
    // per record, because a `themeRoot` resolves through `querySelector`.
    const watched = roots(themeRoot)
    // An empty list is a `themeRoot` that has not mounted yet. Nothing can be
    // matched against, and the record in hand may well be the one that mounts
    // it, so this transient state reads the page back.
    if (watched.length === 0) {
      reevaluate()
      return
    }
    if (records.some((record) => watched.includes(record.target as Element))) reevaluate()
  }

  const connect = () => {
    if (mode !== 'auto' || !isBrowser()) return

    if (typeof window.matchMedia === 'function') {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', reevaluate)
    }

    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(onMutation)
      filter = attributeFilter(darkSelector, lightSelector, themeRoot ?? '')
      if (themeRoot) {
        // A wrapper deep in the page can be mounted or replaced at any time and
        // there is no cheap node to hang that off, so this case watches the
        // document and drops the records it does not care about.
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: filter,
          subtree: true,
        })
      } else {
        bindRoots()
      }
    }
  }

  const disconnect = () => {
    media?.removeEventListener('change', reevaluate)
    media = null
    observer?.disconnect()
    observer = null
    boundBody = undefined
  }

  connect()

  return {
    get theme() {
      return theme
    },
    update(next) {
      const wasAuto = mode === 'auto'
      const prevSelectors = `${darkSelector}|${lightSelector}|${themeRoot ?? ''}`
      if (next.mode !== undefined) mode = next.mode
      if (next.darkSelector !== undefined) darkSelector = next.darkSelector
      if (next.lightSelector !== undefined) lightSelector = next.lightSelector
      if ('themeRoot' in next) themeRoot = next.themeRoot

      // Listeners exist only in auto mode, and the observer's attribute filter
      // is derived from the selectors — so either change means a reconnect.
      const isAuto = mode === 'auto'
      if (
        wasAuto !== isAuto ||
        prevSelectors !== `${darkSelector}|${lightSelector}|${themeRoot ?? ''}`
      ) {
        disconnect()
        connect()
      }
      reevaluate()
    },
    destroy: disconnect,
  }
}
