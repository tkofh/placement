---
'placement': minor
'@placement/vue': patch
---

Add `placement/length`, a CSS `<length-percentage>` value: `Length.px(10)`,
`Length.percent(50)`, or `Length.make(value, unit)`. `Length.resolve(length,
basis)` returns the pixels, and a percentage `p` resolves to
`basis * p / 100`. That result is correctly rounded for an integer basis
and an integer percentage. A plain number passes through as pixels.

`Box` and `Frame` accept a `Length` wherever they took a number for an
inset, offset, size, or min/max constraint. `Box.apply` resolves
percentages against the parent rect, and `Flexbox.apply` resolves each
frame against the container's inner rect. Horizontal fields (`left`,
`right`, `offsetLeft`, `offsetRight`, `width`, `minWidth`, `maxWidth`) are
percentages of the width, and vertical fields are percentages of the
height. A frame's vertical offsets therefore use the height, unlike CSS
margins. `Box.resolve` and `Frame.resolve` return the spec with numbers in
place of its percentages, and return the spec itself when it has none.
Until a spec is resolved, its getters read a percentage as unset, and
`toJSON` keeps it, so a JSON round trip preserves it. Plain numbers behave
as before.

`@placement/vue` now passes box and flex item percentages to the core
unresolved instead of resolving them against the parent rect. Every vue
percentage, gutters and gaps included, now resolves through
`Length.resolve`. The result differs from the old
`basis * value * 0.01` only in the last bit of some non-integer results.
