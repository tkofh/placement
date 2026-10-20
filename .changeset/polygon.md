---
'placement': minor
---

Add `placement/polygon`, regular polygons and star polygons that fill a
rect. `Polygon.make({ sides, loops, phase, radius })` describes one:
`sides` corners (4 by default) on a polygon with a flat top, `phase`
sliding each corner along its edge toward the next (`0.5` turns a rect into
a diamond and a triangle to point up), and `loops` joining every
`loops`-th corner into a star (`sides: 5, loops: 2` is a pentagram).
`Polygon.apply(polygon, rect)` returns its corners, stretched to fill the
rect, and the radius that rounds them. A rounded polygon grows past the
rect until its rounded outline fills it, so rounding a diamond keeps its
tips on the rect. The radius is at most what every corner fits, which makes
a rect at most a pill.
