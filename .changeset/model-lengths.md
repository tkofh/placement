---
'placement': minor
---

`placement/unstable/model` props take percentages. `box` accepts a
`Box.BoxInput<LengthInput>`, `frame` a `Frame.FrameInput<LengthInput>`,
`gutter` a `Model.GutterInput`, and `translate` a `Model.TranslateInput`,
whose lengths are numbers or `Length`s from `placement/length`, besides the
built `Box`, `Frame`, `Offset`, or `Point`. Each node resolves a percentage
against its basis: a box against its parent's rect, a gutter and a
translation against the node's own placed rect, and a frame against its
flex container's content rect. A percentage re-resolves whenever its basis
changes.
