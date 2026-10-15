---
'placement': minor
---

Add `placement/box`, a positioned-box spec and solver. It is CSS absolute
positioning without a DOM, and the counterpart to `Frame`/`Flexbox.apply`.
`Box.make` takes insets (`top`/`right`/`bottom`/`left`), sizing
(`width`/`height`/`aspectRatio`), and constraints (min/max per axis). All of
them are optional, and any non-finite value acts as unset.
`Box.apply(box, parent)` resolves each axis from the explicit size, else the
inset pair, else the ratio from the other determined axis, else a fill. It
then clamps to the constraints and anchors to the start inset, else to the end
inset measured with the used size. The setters mirror those of `Frame`:
`setInset` (CSS shorthand), `setSize`, `setAspectRatio`,
`setMinSize`/`setMaxSize`, and the per-field forms.

Fix crossed sizing constraints in `Frame`. The minimum now wins over a lower
maximum, as in CSS `clamp()` and as the JSDoc already promised.
`Frame.make({ width: 120, minWidth: 100, maxWidth: 50 }).width` is now `100`
(previously `50`). The effective `maxWidth`/`maxHeight` getters report the
raised bound, and the flex solvers inherit the ordered constraints.
