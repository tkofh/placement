---
'@placement/vue': minor
---

Positional layout now runs through the new `placement/box` solver of the core,
instead of a hand-rolled axis solver in `useRect`. The composable builds a
`Box` from the inset, sizing, and constraint props and applies it against the
parent rect. `GraphicText` and `GraphicCircle` share it through the new
`useRect` options: a `size` override for measured or radius-derived
dimensions, and an `origin` fallback. `useAxisInterval` is removed.

These behavior changes all move toward CSS semantics:

- Explicit `width`/`height` now clamp to `min-*`/`max-*`. Previously, only
  auto sizes did.
- `right`/`bottom`-anchored boxes measure with the used (clamped) size.
- `aspect-ratio` can now derive a dimension from an inset-determined axis.
  `top="0" bottom="0" aspect-ratio="1"` sizes the width from the height.
- `GraphicCircle` honors the `x`/`y` translate props that it previously
  ignored.
