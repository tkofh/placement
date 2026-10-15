---
'@placement/vue': minor
---

Sizing resolution now belongs entirely to the core. `FlexItem` passes
`width`/`height`/`aspect-ratio` and the min/max constraints raw into
`Frame.make`, instead of deriving the ratio in vue first. `GraphicRoot`
resolves its own size through a `Box` applied to the measured `<svg>` rect.
This release removes the `useSize` composable, its
`useBasisSize`/`useMinSize`/`useMaxSize`/`useConstrainedSize` wrappers, and
the `@placement/vue/props/size` subpath. `useLengthPercentage` is the per-axis
composable that remains.

These behavior changes all match the documented semantics of the core:

- A ratio now derives from the clamped source dimension.
  `width="100px" aspect-ratio="2" max-width="50px"` yields 50x25, not 50x50.
- A ratio plus a positive minimum on one axis drives the other axis.
  `aspect-ratio="2" min-width="100px"` yields 100x50, not 100x0.
- A `max-*` constraint on `GraphicRoot` caps the measured dimension instead of
  replacing an unset one.
