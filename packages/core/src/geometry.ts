/**
 * Reading an element's geometry as it is actually painted.
 *
 * Shared by every effect that attaches itself to an element rather than to the
 * pointer. Kept in one place because the two corrections it carries were both
 * found the hard way, and a second copy would have to be found the hard way
 * again: the box model's numbers are not the ones on screen, and an element's
 * own transform is not the only one acting on it.
 */

/** The linear part of a 2D transform. Translation is read off the rect instead. */
export interface Linear {
  a: number
  b: number
  c: number
  d: number
}

/** Identity, for an element with no transform of its own. */
const NO_TRANSFORM: Linear = { a: 1, b: 0, c: 0, d: 1 }

/** `outer` applied after `inner`, which is how the DOM composes them. */
const compose = (outer: Linear, inner: Linear): Linear => ({
  a: outer.a * inner.a + outer.c * inner.b,
  b: outer.b * inner.a + outer.d * inner.b,
  c: outer.a * inner.c + outer.c * inner.d,
  d: outer.b * inner.c + outer.d * inner.d,
})

/** Deep enough for any real page; a guard against a pathological ancestor chain. */
const MAX_DEPTH = 32

/**
 * The 2D part of a computed `transform`, without `DOMMatrix`.
 *
 * Parsed rather than constructed because `DOMMatrix` is missing in jsdom, and
 * only the four linear terms matter here — translation is already accounted
 * for by the element's rect.
 */
export const readTransform = (value: string): Linear => {
  if (!value || value === 'none') return NO_TRANSFORM
  const parts = value.match(/-?[\d.]+(?:e[+-]?\d+)?/g)
  if (!parts) return NO_TRANSFORM
  const n = parts.map(Number)
  // `matrix3d` is column-major 4x4; its 2D terms are at 0, 1, 4, 5.
  const [a, b, c, d] = value.startsWith('matrix3d')
    ? [n[0], n[1], n[4], n[5]]
    : [n[0], n[1], n[2], n[3]]
  return [a, b, c, d].every((v) => typeof v === 'number' && Number.isFinite(v))
    ? { a: a as number, b: b as number, c: c as number, d: d as number }
    : NO_TRANSFORM
}

/**
 * The element's transform in screen space, ancestors included.
 *
 * Reading only the element's own is not enough, and our own site is the
 * proof: the menu pills are laid out upright and turned by the list item
 * holding them, while a magnet writes a plain `translate3d` onto the pill
 * itself — overriding the CSS rotation that used to be there. An element can
 * be visibly tilted while its own computed transform says it is not.
 */
export const screenTransform = (node: Element): Linear => {
  let total = NO_TRANSFORM
  let el: Element | null = node
  for (let depth = 0; el && depth < MAX_DEPTH; el = el.parentElement, depth += 1) {
    const own = readTransform(getComputedStyle(el).transform)
    if (own !== NO_TRANSFORM) total = compose(own, total)
  }
  return total
}

/**
 * The size layout gives an element, before any transform.
 *
 * `getBoundingClientRect` reports the axis-aligned box *around* a rotated
 * element, which is larger than the element and square to the screen. Tracing
 * that around a tilted pill draws an upright rectangle that touches it at four
 * points and matches it nowhere.
 *
 * `offsetWidth` is 0 for an SVG element and under jsdom; the rect is the only
 * thing left to go on there, and for an unrotated element it is right.
 */
export interface ScreenBox {
  /** Centre in viewport coordinates. Any affine map takes the centre to the centre. */
  x: number
  y: number
  /** The element's own size, scaled by whatever scale the transform carries. */
  width: number
  height: number
  /** Degrees, accumulated through the ancestors. */
  rotation: number
  /** The scales that were applied, for anything measured in the element's own units. */
  scaleX: number
  scaleY: number
}

export const readScreenBox = (node: Element): ScreenBox => {
  const rect = node.getBoundingClientRect()
  const { a, b, c, d } = screenTransform(node)
  const scaleX = Math.hypot(a, b) || 1
  const scaleY = Math.hypot(c, d) || 1
  const layout = node as Partial<HTMLElement>
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    width: (layout.offsetWidth || rect.width / scaleX) * scaleX,
    height: (layout.offsetHeight || rect.height / scaleY) * scaleY,
    rotation: (Math.atan2(b, a) * 180) / Math.PI,
    scaleX,
    scaleY,
  }
}
