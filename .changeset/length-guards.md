---
'placement': minor
---

Add `Length.isLengthInput`, which checks for a number or a `Length`, and
`AspectRatio.isAspectRatio`, which checks for a number or a
`[width, height]` pair of numbers. Both check the shape only, so a
non-finite value still passes.
