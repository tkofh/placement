---
'placement': minor
'@placement/vue': patch
---

Ratio fields accept a `[width, height]` pair, such as `[16, 9]` for CSS
`16 / 9`, wherever they took a ratio number: `Box.make`, `Frame.make`,
their `setAspectRatio`, and the `Dimensions` ops `contain`, `cover`, and
`setAspectRatio`. A `[w, h]` pair derives a width as `height * w / h` in
one rounding, where the number `16 / 9` is already rounded before it
scales anything. With the number, a height of
`7` derives a width of `12.444444444444443`. With the pair it derives the
correctly rounded `12.444444444444445`. A plain number `n` behaves exactly
as before, the same as `[n, 1]`. The `aspectRatio` getters still return
numbers, and `toJSON` keeps the pair.

`placement/aspectRatio` exports the `AspectRatio` type
(`number | readonly [width, height]`) and the plain functions
`toNumber`, `heightFor`, and `widthFor`.

`@placement/vue` passes a ratio prop such as `'16 / 9'` to the core as a
pair, so boxes and frames derive from it with one rounding.
