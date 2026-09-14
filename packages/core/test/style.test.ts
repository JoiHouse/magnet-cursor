import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The shipped stylesheet, asserted as text.
 *
 * The rest of the suite mounts a cursor in jsdom, which resolves no external
 * stylesheet — so nothing else here can see what `style.css` actually paints.
 * That gap is not theoretical: the item state shipped applying to the head and
 * not to the trail drops, which put a disc of the idle colour in the middle of
 * the hovered one. Reading the file is coarse, but it is the only thing in the
 * suite that would have caught it.
 */
// The suite runs from the workspace root or from the package, and jsdom leaves
// `import.meta.url` without a file scheme — so the path is found, not derived.
const sheet = ['packages/core/public/style.css', 'public/style.css']
  .map((path) => resolve(process.cwd(), path))
  .find(existsSync)

const css = readFileSync(sheet!, 'utf8')

/** The selectors of the rule whose body contains `needle`. */
const ruleWith = (needle: string): string => {
  const at = css.indexOf(needle)
  expect(at, `no rule containing ${needle}`).toBeGreaterThan(-1)
  const open = css.lastIndexOf('{', at)
  return css.slice(css.lastIndexOf('}', open) + 1, open)
}

describe('style.css', () => {
  /**
   * Both are inside the goo filter, which flattens the body to one silhouette
   * and restores a single alpha over all of it. A drop left on the idle colour
   * therefore cannot read as a fainter drop — only as a different colour.
   */
  it('takes the head and the drops into the item state together', () => {
    const rule = ruleWith('--mc-item-scale')
    expect(rule).toContain('__head::after')
    expect(rule).toContain('__drop::after')
  })

  it('paints the item state from itemColor, not from the idle colour', () => {
    expect(ruleWith('--mc-item-color')).toContain('.magnet-cursor--item')
  })

  /**
   * A merge is announced before it lands, and the disc used to spend the gap
   * growing into a hover size it was about to be told to drop.
   */
  it('holds the item state back while a merge is coming', () => {
    for (const needle of ['--mc-item-scale', 'backdrop-filter']) {
      expect(ruleWith(needle)).toContain(':not(.magnet-cursor--merging)')
    }
  })

  /**
   * The drops must ease between states with the head. Overriding their
   * transition down to opacity left them snapping to the item size and colour
   * while the head eased — one body moving at two speeds.
   */
  it('eases the drops between states along with the head', () => {
    // One transition, named once, covering both — not a drop rule that
    // overrides it back down to opacity.
    const rule = ruleWith('transform 0.3s ease')
    expect(rule).toContain('__head::after')
    expect(rule).toContain('__drop::after')
  })

  /**
   * A backdrop blur reads no further back than its nearest filtered ancestor.
   * The head is filtered in the item state and the body is whenever a trail is
   * on, so the blur shipped on the head's disc and painted nothing in Chrome,
   * Safari or Firefox. It has to live outside both — and one per drop, every
   * frame, would buy nothing.
   */
  it('keeps the backdrop blur outside every filtered element', () => {
    const rules = [...css.matchAll(/([^{}]*)\{[^}]*backdrop-filter[^}]*\}/g)].map((m) => m[1]!)
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule).toContain('.magnet-cursor__backdrop::after')
      expect(rule).not.toContain('__head')
      expect(rule).not.toContain('__drop')
      expect(rule).not.toContain('__body')
    }
  })

  /**
   * The blur layer stands in for the head's disc, so every rule that hides the
   * disc from under a held item state has to take the layer with it — or the
   * blur outlives the disc it was drawn for.
   */
  it('hides the backdrop layer wherever it hides the head', () => {
    for (const state of [
      '.magnet-cursor--hidden',
      '[data-magnet-cursor-gravitating]',
      '.magnet-cursor--merged:not(.magnet-cursor--morph-border)',
    ]) {
      const at = css.indexOf(`${state} .magnet-cursor__head::after`)
      expect(at, `no rule for ${state}`).toBeGreaterThan(-1)
      expect(css.slice(at, css.indexOf('{', at))).toContain(
        `${state} .magnet-cursor__backdrop::after`,
      )
    }
  })

  /**
   * While the cursor blends, the blur layer sits in a host outside the root, so
   * the host has to take the root's place: fixed at the origin under the same
   * z-index, and gone on touch devices the way the root is.
   */
  it('positions the backdrop host like the root, without a blend mode', () => {
    const at = css.indexOf('.magnet-cursor__backdrop-host {')
    expect(at, 'no backdrop host rule').toBeGreaterThan(-1)
    const body = css.slice(at, css.indexOf('}', at))
    expect(body).toContain('position: fixed')
    expect(body).toContain('var(--mc-z-index')
    expect(body).not.toContain('mix-blend-mode')

    const touch = css.slice(css.indexOf('@media (hover: none)'))
    expect(touch.slice(0, touch.indexOf('}'))).toContain('.magnet-cursor__backdrop-host')
  })

  /**
   * The wave is cut by a mask, so the SVG is a constant and the colour comes
   * from `background-color`. Putting the colour inside the data URI would mean
   * encoding an option value into a URL on every change — the surface
   * SECURITY.md names in as many words.
   */
  it('keeps the colour out of the wave data URI', () => {
    const wave = /--mc-wave:\s*url\("([^"]+)"\)/.exec(css)
    expect(wave, 'no --mc-wave declaration').not.toBeNull()
    expect(wave![1]).toContain('svg+xml')
    expect(wave![1]).not.toContain('mc-underline-color')
    // Black is the mask's own ink; any other colour would mean paint in the URL.
    expect(wave![1]!.match(/%23[0-9a-fA-F]{3,8}/g) ?? []).toEqual(['%23000'])
  })

  /** The underline is a rule, thinner than the ring the goo filter erased. */
  it('keeps the underline out of the filtered body', () => {
    const rule = ruleWith('--mc-underline-color')
    expect(rule).toContain('.magnet-cursor__underline')
    expect(rule).not.toContain('__body')
  })

  /**
   * A liquid surface is usually a button, so it is also an item — and the item
   * rule carries three classes against this one's attribute and class. Without
   * `!important` the hidden disc came back at `itemScale` over the very
   * element that had claimed the pointer.
   */
  it('lets a gravitating surface outrank the item state', () => {
    const at = css.indexOf('[data-magnet-cursor-gravitating] .magnet-cursor__head::after')
    expect(at, 'no gravitating rule').toBeGreaterThan(-1)
    const body = css.slice(css.indexOf('{', at), css.indexOf('}', at))
    expect(body).toContain('opacity: 0 !important')
    expect(body).toContain('transform: scale(0) !important')
  })

  /** While merged the element is the cursor, so the whole body steps aside. */
  it('hides the head and the drops while merged', () => {
    const rule = ruleWith('scale(0.2)')
    expect(rule).toContain('.magnet-cursor--merged .magnet-cursor__head::after')
    expect(rule).toContain('.magnet-cursor--merged .magnet-cursor__drop::after')
  })

  /**
   * The item rule carries three classes; the hidden rule used to carry one, so
   * a pointer that left the window while the item state was held kept the disc
   * painted at `--mc-item-scale` in the corner it left through.
   */
  it('lets an absent pointer outrank the item state', () => {
    // Found by selector: the declarations are the same ones the gravitating
    // rule above writes, so a needle from the body would land on that instead.
    const at = css.indexOf('.magnet-cursor--hidden .magnet-cursor__head::after')
    expect(at, 'no rule hiding the head while the pointer is away').toBeGreaterThan(-1)
    const rule = css.slice(at, css.indexOf('}', at))

    expect(rule).toContain('.magnet-cursor--hidden .magnet-cursor__drop::after')
    expect(rule).toContain('opacity: 0 !important')
    expect(rule).toContain('transform: scale(0) !important')
  })
})
