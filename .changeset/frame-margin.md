---
'placement': minor
---

Rename the frame's offsets to margins, as in CSS: `offsetTop`,
`offsetRight`, `offsetBottom`, and `offsetLeft` are now `marginTop`,
`marginRight`, `marginBottom`, and `marginLeft`, on `FrameInput` and on
`Frame`. The setters follow: `setOffset` is `setMargin`, and
`setOffsetX`, `setOffsetY`, `setOffsetTop`, `setOffsetRight`,
`setOffsetBottom`, and `setOffsetLeft` are `setMarginX`, `setMarginY`,
`setMarginTop`, `setMarginRight`, `setMarginBottom`, and `setMarginLeft`.
Their behavior is unchanged: a non-finite margin is still auto.
