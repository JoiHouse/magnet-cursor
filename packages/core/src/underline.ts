import { readScreenBox } from './geometry'

/**
 * Underlining whatever the pointer is on.
 *
 * The third thing the cursor can attach to an element, after the item state
 * and the merge — and the least intrusive of them: it adds a line under the
 * element rather than repainting the element itself.
 *
 * Scope works exactly as the merge's does, and for the same reason. An element
 * joins by carrying the attribute, and nothing can take that away; `include`
 * only ever widens the set. A region written in one place silently voiding an
 * attribute written in another is a failure with no error and nothing painted,
 * and this repository has already shipped that bug once.
 */
export interface MagnetCursorUnderlineOptions {
  /**
   * An extra region to underline, for markup you cannot annotate. Purely
   * additive: elements carrying `styleAttribute` are underlined either way.
   * Default `null` — only annotated elements are.
   */
  include?: string | null
  /**
   * Attribute that opts an element in and picks its style — `'solid'`,
   * `'dashed'`, `'wavy'`, no value to take `style`, or `'none'` to refuse.
   * Default `'data-magnet-cursor-underline'`.
   */
  styleAttribute?: string
  /** Line style for an element that names none. Default `'solid'`. */
  style?: UnderlineStyle
  /**
   * Which end the line grows from. Default `'left'`.
   *
   * Both are a wipe along the line, which is the only thing a horizontal rule
   * can be revealed by: there is no such thing as wiping one downwards.
   */
  direction?: UnderlineDirection
  /** Line thickness in px. Default `2`. */
  width?: number
  /** Line colour, or `null` to use the cursor's `itemColor`. Default `null`. */
  color?: string | null
  /** Gap between the element's bottom edge and the line, px. Default `2`. */
  offset?: number
  /** Seconds the line takes to draw and to withdraw. Default `0.22`. */
  duration?: number
}

export type UnderlineStyle = 'solid' | 'dashed' | 'wavy'
export type UnderlineDirection = 'left' | 'right'

export type ResolvedUnderline = Required<MagnetCursorUnderlineOptions> & {
  /**
   * What `mouseover` matches against: the attribute, plus `include` when one
   * is given. Derived rather than configured, so the attribute can never be
   * selected away.
   */
  matchSelector: string
}

const underlineDefaults: Omit<ResolvedUnderline, 'matchSelector'> = {
  include: null,
  styleAttribute: 'data-magnet-cursor-underline',
  style: 'solid',
  direction: 'left',
  width: 2,
  color: null,
  offset: 2,
  duration: 0.22,
}

export const resolveUnderline = (
  underline: MagnetCursorUnderlineOptions | false | undefined,
): ResolvedUnderline | null => {
  if (underline === undefined || underline === false) return null
  const resolved = { ...underlineDefaults, ...underline }
  const attr = `[${resolved.styleAttribute}]`
  return {
    ...resolved,
    matchSelector: resolved.include ? `${attr}, ${resolved.include}` : attr,
  }
}

/** Whether two resolved underlines describe the same layer. */
export const sameUnderline = (
  a: ResolvedUnderline | null,
  b: ResolvedUnderline | null,
): boolean => {
  if (a === null || b === null) return a === b
  return (
    a.matchSelector === b.matchSelector &&
    a.styleAttribute === b.styleAttribute &&
    a.style === b.style &&
    a.direction === b.direction &&
    a.width === b.width &&
    a.color === b.color &&
    a.offset === b.offset &&
    a.duration === b.duration
  )
}

/** Below this the draw counts as finished in either direction. */
const SETTLED = 0.002

const STYLES: readonly UnderlineStyle[] = ['solid', 'dashed', 'wavy']

export interface UnderlineInstance {
  readonly element: HTMLElement
  /** Underline `target`, or withdraw when it is `null`. */
  attach: (target: Element | null) => void
  /** The style the current (or last) target asked for. */
  readonly style: UnderlineStyle
  readonly attached: boolean
  /** How far the line is drawn, 0..1. */
  readonly amount: number
  /**
   * Advance one frame and paint. `originX/Y` is where the layer's containing
   * block sits, which is the cursor root — it carries `will-change: transform`
   * and is therefore the containing block for a `position: fixed` child.
   * Returns whether anything is still in motion.
   */
  step: (dt: number, originX: number, originY: number) => boolean
  setOptions: (next: ResolvedUnderline | null) => void
  destroy: () => void
}

/**
 * Create the layer the underline is drawn on.
 *
 * A sibling of the liquid body rather than a child of it. The goo filter is
 * destructive — it blurs and then hard-thresholds alpha, which erases anything
 * thinner than roughly `1.13 * goo` — and a 2px rule is exactly the kind of
 * thing it deletes outright. The merge layer was moved out for the same reason
 * when a border trace vanished under a trail.
 */
export function createUnderline(
  className: string,
  options: ResolvedUnderline | null,
): UnderlineInstance {
  const el = document.createElement('div')
  el.className = className

  let opts = options
  let target: Element | null = null
  let style: UnderlineStyle = options?.style ?? 'solid'
  let amount = 0

  const paint = (originX: number, originY: number) => {
    if (!opts || !target || amount <= 0) {
      el.style.opacity = '0'
      return
    }

    const box = readScreenBox(target)
    const width = box.width
    const left = box.x - width / 2 - originX
    // The element's bottom edge, plus the gap, in the layer's own frame.
    const top = box.y + box.height / 2 + opts.offset - originY

    el.style.width = `${width}px`
    el.style.height = `${opts.width * (opts.style === 'wavy' || style === 'wavy' ? 3 : 1)}px`
    // Rotation after the translation, so it turns about the line's own start.
    const turn = box.rotation ? ` rotate(${box.rotation}deg)` : ''
    el.style.transform = `translate3d(${left}px, ${top}px, 0)${turn} scaleX(${amount})`
    el.style.opacity = '1'
  }

  const sync = () => {
    el.classList.toggle(`${className}--wavy`, style === 'wavy')
    el.classList.toggle(`${className}--dashed`, style === 'dashed')
    // The wipe end is a transform-origin, which is the whole of the direction.
    el.style.transformOrigin = opts?.direction === 'right' ? 'right center' : 'left center'
    if (opts) {
      el.style.setProperty('--mc-underline-width', `${opts.width}px`)
      if (opts.color) el.style.setProperty('--mc-underline-color', opts.color)
      else el.style.removeProperty('--mc-underline-color')
    }
  }

  return {
    element: el,
    attach(next) {
      const asked = next && opts ? next.getAttribute(opts.styleAttribute) : null

      // Resolve the style before anything can bail out, so a refusal cannot
      // leave the previous element's style advertised on the layer.
      if (asked && (STYLES as readonly string[]).includes(asked)) {
        style = asked as UnderlineStyle
      } else if (opts) {
        style = opts.style
      }
      sync()

      if (asked === 'none') {
        target = null
        return
      }
      target = next
    },
    get style() {
      return style
    },
    get attached() {
      return target !== null
    },
    get amount() {
      return amount
    },
    step(dt, originX, originY) {
      if (!opts) {
        if (amount !== 0) {
          amount = 0
          el.style.opacity = '0'
        }
        return false
      }

      const want = target ? 1 : 0
      amount += (want - amount) * (1 - Math.exp(-dt / opts.duration))
      if (Math.abs(want - amount) < SETTLED) amount = want

      paint(originX, originY)

      // Keep running while the line is still being drawn, and while a target
      // could move under it.
      return amount > 0
    },
    setOptions(next) {
      opts = next
      if (!next) {
        target = null
        amount = 0
        el.style.opacity = '0'
        return
      }
      if (!target) style = next.style
      sync()
    },
    destroy() {
      el.remove()
    },
  }
}
