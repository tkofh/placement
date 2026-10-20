---
'@placement/vue': minor
---

`GraphicRoot`, `GraphicGroup`, `FlexLayout`, and `FlexItem` now lay out
through `placement/unstable/model`. Each component owns a node in a model
store. The components parse their props and pass percentages to the model
unresolved, and the model places every node. A prop change waits for Vue's
next pre-flush, and the store applies every change of that flush in one
`mutate`. This release removes the internal `useFlex` composable.

These behavior changes follow from the model's semantics:

- A percentage gutter on `FlexLayout` resolves against the layout's own
  rect, not its parent's. `width="100px" gutter-left="10%"` now gives a
  10px gutter.
- A `FlexItem` resolves its percentages against its flex's content rect,
  even when a `GraphicGroup` sits between the item and the layout.
- A `FlexItem` joins the layout when it mounts and renders with the rect
  solved so far, instead of a zero rect until the next tick. An item that
  the layout cannot reach in its children, such as one under a pending
  `Suspense`, now takes part in the layout after the items the layout can
  reach.
