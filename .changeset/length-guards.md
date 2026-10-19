---
'placement': minor
---

Add `Length.isLengthInput`, which checks for a number or a `Length`, and
`AspectRatio.isAspectRatio`, which checks for a number or a
`[width, height]` pair of numbers. Both check the shape only, so a
non-finite value still passes.

`Box.BoxInput` and `Frame.FrameInput` take the type of their length fields
as a parameter, `L`, which defaults to `number`. `Box.make` and
`Frame.make` still take numbers. A layer that knows the basis can take
`BoxInput<LengthInput>` or `FrameInput<K, LengthInput>` and resolve each
length with `Length.resolve` before it builds the spec.
