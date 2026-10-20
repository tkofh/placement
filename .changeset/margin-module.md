---
'placement': minor
---

Add `placement/margin`, the margin inputs of an item: `MarginInput`, with
the length type as a parameter, `fields`, which names each margin's
percentage axis, and `normalize`, which gives an omitted margin `0` and
keeps a non-finite one auto. `FrameInput` extends `MarginInput`.
