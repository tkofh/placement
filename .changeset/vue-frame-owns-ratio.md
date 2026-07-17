---
'@placement/vue': minor
---

Sizing resolution now belongs entirely to the core. `FlexItem` passes
`width`/`height`/`aspect-ratio` and the min/max constraints raw into
`Frame.make` instead of pre-deriving the ratio in vue, and `GraphicRoot`
resolves its own size through a `Box` applied to the measured `<svg>` rect.
The `useSize` composable, its `useBasisSize`/`useMinSize`/`useMaxSize`/
`useConstrainedSize` wrappers, and the `@placement/vue/props/size` subpath
are removed — `useLengthPercentage` is the per-axis primitive that remains.

Behavior changes, all matching the core's documented semantics: a ratio now
derives from the clamped source dimension (`width="100px" aspect-ratio="2"
max-width="50px"` yields 50x25, not 50x50); a ratio plus a positive minimum
on one axis drives the other (`aspect-ratio="2" min-width="100px"` yields
100x50, not 100x0); and a `GraphicRoot` `max-*` constraint caps the measured
dimension instead of replacing an unset one.
