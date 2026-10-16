---
'@placement/vue': minor
---

Add `GraphicPolygon`, which draws a regular polygon or star polygon that
fills its box (see `placement/polygon`). `sides` sets the number of corners
(a rect by default), `phase` slides them along their edges (`phase="0.5"`
draws a diamond), and `loops` joins them into a star. `r` and `smoothing`
round its corners, and a rounded polygon grows so that its rounded outline
still fills its box.
