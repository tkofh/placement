---
'placement': minor
---

Add `placement/box`: a positioned-box spec and solver — CSS absolute
positioning without a DOM, the counterpart to `Frame`/`Flexbox.apply`.
`Box.make` takes insets (`top`/`right`/`bottom`/`left`), sizing
(`width`/`height`/`aspectRatio`), and constraints (min/max per axis), all
optional, with any non-finite value acting as unset; `Box.apply(box, parent)`
resolves each axis (explicit size, else inset pair, else ratio from the other
determined axis, else fill), clamps to the constraints, and anchors to the
start inset, else the end inset measured with the used size. Setters mirror
`Frame`'s (`setInset` CSS shorthand, `setSize`, `setAspectRatio`,
`setMinSize`/`setMaxSize`, and the per-field forms).

Fix crossed sizing constraints in `Frame`: the minimum now wins over a lower
maximum, as CSS `clamp()` resolves and as the JSDoc already promised —
`Frame.make({ width: 120, minWidth: 100, maxWidth: 50 }).width` is now `100`
(previously `50`). The effective `maxWidth`/`maxHeight` getters report the
raised bound, and the flex solvers inherit the ordered constraints.
