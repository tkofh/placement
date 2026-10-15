---
'@placement/vue': minor
---

Adopt the placement 0.4 core rewrite, fix reactivity bugs, and make the package smaller.

Changes that follow from the core rewrite:

- Upgrade to valued 0.5. Combinators and multipliers import from its root.
- Precision props and params are gone.
- `contract` replaces `shrinkByOffset`, and `stretch` replaces `stretchCross`.
- The `justifySelf` prop and its `./props/justifySelf` subpath are removed, because justify-self does not apply to flexbox.
- `vue` is now a peer dependency.
- `@nuxt/kit`/`@nuxt/schema` are optional peers, so plain Vue apps no longer install Nuxt.
- The unused `colorjs.io` dependency is gone.
- Exports are ESM-only and list types first.

Fixed:

- `GraphicPoint`s registered at index 0 and overwrote each other on reactive updates.
- `FlexItem` swapped `margin-top` and `margin-bottom`.
- Four of the six `preferCached*` prop wrappers never received their previous value, which defeated structural sharing.
- The `r` prop cache ignored its fallback and sometimes served another component's default.
- A frame update without a registered index overwrote the last item.
- When a child created sizing-context computeds, they were disposed with that child while siblings still held them.
- `align-items="stretch"` did nothing, because per-item stretch was pinned to `0` instead of inheriting.
- `fill-opacity`/`stroke-opacity`/`fill-rule` were emitted as camelCase attributes, which browsers ignore.
- `:opacity="0"` rendered no attribute at all.
- The internal LRU cache evicted every entry it returned, so every hit was a miss.
- Child indexes went permanently stale when items mounted, unmounted, or reordered behind an intermediate component boundary.

Child registration is a new registry that walks the VNode tree (`useChildren`/`useChild`). Children resolve in component-tree order without DOM `compareDocumentPosition`. They survive mount, unmount, and keyed reorder behind intermediate component boundaries. Traversal stops at nested same-type providers, and resolution is synchronous under SSR. The registry replaces the index-based frames/rects/points arrays outright (`useFlex` dropped from 105 lines to 30).

Other internal changes:

- An `Infinity` size sentinel from the sizing props no longer leaks into frames as a literal infinite preference, which defeated inherited stretch.
- Frames and points live in `shallowRef`s. Core values are immutable, so deep proxying was pure overhead.
- Injection keys are namespaced under `Symbol.for('placement/*')`.
- Dead resolvers (`size2d`, `inset`, `fit`) and commented-out code are deleted.
- `GraphicLineProps`/`GraphicPointProps` are exported, and the props interface of `GraphicGroup` is no longer named after `GraphicRect`.
