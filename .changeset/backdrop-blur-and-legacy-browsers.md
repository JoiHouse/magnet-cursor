---
'@joihouse/magnet-cursor-core': patch
'@joihouse/magnet-cursor-react': patch
'@joihouse/magnet-cursor-vue': patch
---

Fix the item state's backdrop blur, which never painted, and keep older browsers from breaking.

- The blur behind the hovered cursor sat on the head's disc, under the head's own `filter` and, with a trail on, under the goo filter. A backdrop blur cannot read past a filtered ancestor, so it rendered nothing in Chrome, Safari or Firefox. It now lives on a new `.magnet-cursor__backdrop` layer beside the liquid body, and shows with and without a trail. If you restyle the cursor under a custom `className`, style `<className>__backdrop` and `<className>__backdrop-host` the way `style.css` does.
- In Safari, a hovered cursor with a trail on no longer renders as a saturated, glowing disc. That look came from the dead blur leaking into the goo filter, and Chrome and Firefox never showed it.
- The backdrop blur also shows while `blendMode` is not `'normal'`. A blending root is a boundary no blur inside it can read past, so in that case the layer moves to a `.magnet-cursor__backdrop-host` element placed just before the cursor. The cursor still blends as one shape; the blur beneath it does not blend.
- The cursor now hides when the window loses focus, and when the pointer leaves the page with only a top-level `mouseout` to say so. Safari fired no `mouseleave` on blur, so the cursor stayed painted where the pointer had been. It reappears on the next pointer move.
- `theme: 'auto'` no longer throws on Safari before 14, where `MediaQueryList` has only `addListener`.
- The gravitational liquid surface no longer depends on the `inset` shorthand (Chrome 87, Safari 14.1).
- SVG filters are now assembled with DOM APIs, so paint and filter options are treated as attribute values rather than parsed as markup.
