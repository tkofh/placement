---
'@placement/vue': minor
---

Add curves, built on curvy. `GraphicCurve` draws a spline through its
`GraphicPoint` children, with centripetal Catmull-Rom by default. Its props:

- `curve` selects basis, cubic Bézier, or polyline.
- `tension`/`alpha` tune the cardinal family.
- `ends` chooses the endpoint padding: `duplicate` (the default), `reflect`,
  `interpolate`, or `natural`.
- `closed` closes the path.

`GraphicPath` renders any curvy path or spline object, and approximates
rational forms to `tolerance`. It draws either in parent-local pixels or with
`fit`, which maps its bounding box onto the parent rect (`fill`, `contain`,
`cover`). Both components take the usual paint props and default to
`fill="none"`.
