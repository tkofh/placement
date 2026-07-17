---
'@placement/vue': minor
---

Add curves, powered by curvy. `GraphicCurve` draws a spline through its
`GraphicPoint` children — centripetal Catmull-Rom by default, with `curve`
selecting basis, cubic Bézier, or polyline, `tension`/`alpha` tuning the
cardinal family, `ends` choosing the endpoint padding (`duplicate` default,
`reflect`, `interpolate`, or `natural`), and `closed` sealing the path.
`GraphicPath` renders any curvy path or spline object (rational forms are
approximated to `tolerance`), either in parent-local pixels or with `fit`
mapping its bounding box onto the parent rect (`fill`, `contain`, `cover`).
Both take the usual paint props and default to `fill="none"`.
