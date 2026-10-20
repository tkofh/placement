---
'placement': minor
'@placement/vue': patch
---

Add `placement/length`, a CSS `<length-percentage>` value: `Length.px(10)`,
`Length.percent(50)`, or `Length.make(value, unit)`. `Length.resolve(length,
basis)` returns the pixels, and a percentage `p` resolves to
`basis * p / 100`. That result is correctly rounded for an integer basis
and an integer percentage. A plain number passes through as pixels. The
layout specs (`Box`, `Frame`) still take numbers: whatever knows the basis
resolves a length before it builds a spec.

`@placement/vue` now resolves every percentage through `Length.resolve`.
The result differs from the old `basis * value * 0.01` only in the last
bit of some non-integer results.
