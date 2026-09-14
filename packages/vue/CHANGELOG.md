# @joihouse/magnet-cursor-vue

## 0.1.2

### Patch Changes

- [#19](https://github.com/JoiHouse/magnet-cursor/pull/19) [`ad7d75f`](https://github.com/JoiHouse/magnet-cursor/commit/ad7d75fc44d384843ee24432daeedfc6d609c1e1) Thanks [@JoiHouse](https://github.com/JoiHouse)! - Fix the item state's backdrop blur, which never painted, and keep older browsers from breaking.
  
  - The blur behind the hovered cursor sat on the head's disc, under the head's own `filter` and, with a trail on, under the goo filter. A backdrop blur cannot read past a filtered ancestor, so it rendered nothing in Chrome, Safari or Firefox. It now lives on a new `.magnet-cursor__backdrop` layer beside the liquid body, and shows with and without a trail. If you restyle the cursor under a custom `className`, style `<className>__backdrop` and `<className>__backdrop-host` the way `style.css` does.
  - In Safari, a hovered cursor with a trail on no longer renders as a saturated, glowing disc. That look came from the dead blur leaking into the goo filter, and Chrome and Firefox never showed it.
  - The backdrop blur also shows while `blendMode` is not `'normal'`. A blending root is a boundary no blur inside it can read past, so in that case the layer moves to a `.magnet-cursor__backdrop-host` element placed just before the cursor. The cursor still blends as one shape; the blur beneath it does not blend.
  - The cursor now hides when the window loses focus, and when the pointer leaves the page with only a top-level `mouseout` to say so. Safari fired no `mouseleave` on blur, so the cursor stayed painted where the pointer had been. It reappears on the next pointer move.
  - `theme: 'auto'` no longer throws on Safari before 14, where `MediaQueryList` has only `addListener`.
  - The gravitational liquid surface no longer depends on the `inset` shorthand (Chrome 87, Safari 14.1).
  - SVG filters are now assembled with DOM APIs, so paint and filter options are treated as attribute values rather than parsed as markup.
- Updated dependencies [[`ad7d75f`](https://github.com/JoiHouse/magnet-cursor/commit/ad7d75fc44d384843ee24432daeedfc6d609c1e1)]:
  - @joihouse/magnet-cursor-core@0.1.2

## 0.1.1

### Patch Changes

- [#9](https://github.com/JoiHouse/magnet-cursor/pull/9) [`f572e42`](https://github.com/JoiHouse/magnet-cursor/commit/f572e420e12c72dea1cd78bbbe9f68e438a2576b) Thanks [@JoiHouse](https://github.com/JoiHouse)! - Publish through npm trusted publishing (OIDC) instead of a long-lived token. No runtime changes; the
  tarballs carry the same code as 0.1.0 with provenance attached by the trusted publisher.
- Updated dependencies [[`f572e42`](https://github.com/JoiHouse/magnet-cursor/commit/f572e420e12c72dea1cd78bbbe9f68e438a2576b)]:
  - @joihouse/magnet-cursor-core@0.1.1

## 0.1.0

### Minor Changes

- [`13fe8e1`](https://github.com/JoiHouse/magnet-cursor/commit/13fe8e1f85530688088d0f1ca9cc79fc885b9228) Thanks [@JoiHouse](https://github.com/JoiHouse)! - Initial release: a trailing magnetic cursor and magnetic hover elements, with a framework-agnostic
  core plus Vue 3 and React bindings. SSR safe, and inert on touch-only devices and under
  `prefers-reduced-motion`. The cursor render loop is on demand — it runs while catching up to the
  pointer and stops once settled, so a still pointer costs no animation frames, and every magnet on the
  page shares a single frame that batches all layout reads ahead of all writes. Each package also
  exposes `/cursor` and `/magnet` subpaths so either effect can be imported on its own. The cursor is
  a circle at rest and deforms into a liquid tail as it travels, and any element can override its
  fill through `data-magnet-cursor-color`. The follow and the deformation are both integrated over
  elapsed time, so the cursor behaves the same at any refresh rate, and nothing is drawn until the
  pointer has been located. `blendMode` lets the cursor blend with the page rather than cover it, and `<Magnet>` accepts
  `magnetTarget` so an anchor can keep its own `target`. The cursor can also merge into whatever it
  points at — becoming that element's hover background or its border — with an idle nudge so it never
  becomes impossible to find. Alongside the cursor and the
  magnets there is a third effect, `createGravitationalLiquid`, where a subtractive blob is drawn to
  the pointer by a damped spring and erodes the surface it moves across, and an opt-in gooey trail
  that drags a queue of drops behind the cursor through an SVG goo filter.

### Patch Changes

- Updated dependencies [[`13fe8e1`](https://github.com/JoiHouse/magnet-cursor/commit/13fe8e1f85530688088d0f1ca9cc79fc885b9228)]:
  - @joihouse/magnet-cursor-core@0.1.0
