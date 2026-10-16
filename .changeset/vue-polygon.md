---
'@placement/vue': minor
---

Add `GraphicPolygon`, which draws a closed polygon inside its box. Its
`points` take the form of CSS `polygon()`: comma-separated `x y` pairs of
lengths or percentages of the box, such as `'0% 0%, 100% 50%, 0% 100%'` for a
triangle pointing right. `r` and `smoothing` round its corners.
