---
'placement': minor
---

Add `placement/alignment`, the self-alignment slice. `AlignInput` is the
one-axis flavor (`align`, `stretch`) for a layout that names the axis:
flex, hierarchy, and adornments. `Align2dInput` is the two-axis flavor
(`alignX`, `alignY`, `stretchX`, `stretchY`) for a layout that names none.
`resolve` takes an item's alignment on one axis and its layout's default,
and `x` and `y` read each axis of the two-axis flavor, so both flavors
share one resolve. `inherit` is the `Infinity` sentinel, and `fields` and
`fields2d` are the field tables. `FrameInput` extends `AlignInput`.

`Box` takes the two-axis flavor. `stretchX` is how much of the room its
insets leave the box absorbs into its width, and `alignX` is where it sits
in the room left over. An inherited field takes the box's default, which
is what `Box.apply` already did: the box fills the room unless its width
is set or the ratio sizes it, and it anchors to `right` only when `left`
is unset. `Box.setAlign`, `setAlignX`, `setAlignY`, `setStretch`,
`setStretchX`, and `setStretchY` set them.
