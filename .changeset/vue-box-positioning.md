---
'@placement/vue': minor
---

Positional layout now runs through the core's new `placement/box` solver
instead of a hand-rolled axis solver in `useRect`: the composable builds a
`Box` from the inset/sizing/constraint props and applies it against the
parent rect, `GraphicText` and `GraphicCircle` share it through the new
`useRect` options (`size` override for measured/radius-derived dimensions,
`origin` fallback), and `useAxisInterval` is gone.

Behavior changes, all toward CSS semantics: explicit `width`/`height` now
clamp to `min-*`/`max-*` (previously only auto sizes did);
`right`/`bottom`-anchored boxes measure with the used (clamped) size;
`aspect-ratio` can now derive a dimension from an inset-determined axis
(`top="0" bottom="0" aspect-ratio="1"` sizes the width from the height); and
`GraphicCircle` honors the `x`/`y` translate props it previously ignored.
