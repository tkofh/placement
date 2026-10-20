---
'@placement/vue': minor
---

Add smoothed corners. `GraphicRect` takes `smoothing`, and `GraphicCurve`
(with `curve="linear"`) and `HierarchyEdge` take `r` and `smoothing`, which
round a polyline's corners. `smoothing` runs from `0` (circular corners, the
default) to `1` (fully smoothed, squircle-like), as a number or a percentage.

A smoothed corner eases its curvature in from the straight sides instead of
jumping to the arc's, so every join is continuous in position, direction, and
curvature. It reaches `(1 + smoothing)` radii along each side. When a side
is too short, the corner gives up smoothing first and radius second, the
way CSS and SVG clamp radii. A closed `GraphicCurve` rounds its closing
corners too. `GraphicRect` keeps rendering a native `<rect>` until
`smoothing` is set.
