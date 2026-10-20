---
'placement': minor
'@placement/vue': patch
---

Add `placement/sizing`, the sizing inputs that every layout reads:
`width`, `height`, `aspectRatio`, and the min/max bounds. `SizingInput`
is the input type, and `fields` names each field's percentage axis.
`normalize` reads every non-finite size or bound as unset, and `resolve`
gives an item its width and height from its sizing and from what its
layout supplies: the size of an unset axis, and which axes the layout has
fixed. A fixed axis drives the ratio. `FrameInput` and `BoxInput` extend
`SizingInput`, and both take the length type as a parameter
(`FrameInput<LengthInput>`), as `SizingInput` does.

`Frame` and `Box` now resolve their sizing through `resolve`, and read
sizing the same way. A non-finite size or bound on a frame is unset, as it
already was on a box: `Frame.make({ width: Infinity })` is no longer an
infinite width, a `NaN` bound no longer poisons the frame, and an infinite
`aspectRatio` is unset.

An item's aspect ratio now follows the sizes its layout gives it:

- In `Flexbox.apply`, an unset cross size follows the main size that
  `grow` and `shrink` give the item, unless a stretch sizes the cross axis.
  An unset main size follows a stretched cross size: a lone line stretches
  into the container's cross size, and each of several lines into its
  largest item, after which the line solves its main axis again.
- In `Hierarchy.apply`, a node stretched within its rank takes its unset
  size across the flow from its stretched size along it.

`@placement/vue` items with an `aspect-ratio` follow the same rules.
