---
'@placement/vue': minor
---

Track the placement 0.4 core rewrite, fix reactivity bugs, and slim the package.

**Core fallout.** valued 0.5 (combinators/multipliers import from the root), no more precision props/params, `contract` instead of `shrinkByOffset`, `stretch` instead of `stretchCross`. The `justifySelf` prop and its `./props/justifySelf` subpath are removed (justify-self does not apply to flexbox). `vue` is now a peer dependency; `@nuxt/kit`/`@nuxt/schema` are optional peers (plain Vue apps no longer install Nuxt); the unused `colorjs.io` dependency is gone. ESM-only, types-first exports.

**Fixed.** `GraphicPoint`s registered at index 0 and clobbered each other on reactive updates; `FlexItem`'s `margin-top`/`margin-bottom` were swapped; four of the six `preferCached*` prop wrappers never received their previous value, defeating structural sharing; the `r` prop cache ignored its fallback and could serve another component's default; a frame update without a registered index overwrote the last item; sizing-context computeds created by a child were disposed with that child while siblings still held them; `align-items="stretch"` was a no-op (per-item stretch was pinned to `0` instead of inheriting); `fill-opacity`/`stroke-opacity`/`fill-rule` were emitted as camelCase attributes browsers ignore; `:opacity="0"` rendered no attribute at all; the internal LRU cache evicted every entry it returned, so every hit was a miss; child indexes went permanently stale when items mounted, unmounted, or reordered behind an intermediate component boundary.

**Internals.** Frames and points live in `shallowRef`s (core values are immutable — deep proxying was pure overhead); injection keys are namespaced under `Symbol.for('placement/*')`; dead resolvers (`size2d`, `inset`, `fit`) and commented-out code are deleted; `GraphicLineProps`/`GraphicPointProps` are exported and `GraphicGroup`'s props interface is no longer named after `GraphicRect`.
