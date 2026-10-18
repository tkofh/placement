---
'placement': minor
'@placement/vue': patch
---

Add `placement/aspectRatio`, a CSS `<ratio>` value that keeps its
numerator and denominator: `AspectRatio.make(16, 9)`. `heightFor` returns
`width * denominator / numerator` and `widthFor` returns
`height * numerator / denominator`, so a derived extent rounds once. With
the quotient `16 / 9`, a height of `7` derives a width of
`12.444444444444443`. With the pair it derives the correctly rounded
`12.444444444444445`. `toNumber` and `equals` (by value, so `16 / 9`
equals `32 / 18`) round out the module.

`Box.make`, `Frame.make`, their `setAspectRatio`, and the `Dimensions` ops
`contain`, `cover`, and `setAspectRatio` accept an `AspectRatio` wherever
they took a ratio number. A plain number `n` behaves exactly as before,
the same as `AspectRatio.make(n, 1)`. The `aspectRatio` getters still
return numbers. `toJSON` keeps the pair, and `make` reads its JSON record
back.

`@placement/vue` passes a ratio prop such as `'16 / 9'` to the core as a
pair, so boxes and frames derive from it with one rounding.
