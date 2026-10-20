---
'placement': patch
---

`Connector.apply` no longer squeezes a route onto two others that hold
still on either side of it. The runs out of ports and through waypoints
never move, and a route that ran between two of them, beside one
over part of its run and the other over the rest, closer together than
the `gap` and the strokes on both sides, had nowhere to go: the nudge
pressed it onto them or split it into jogs, and reported a crowded
channel between no rects. Such a route now crosses them or goes around
them instead. It also keeps out of every other gap that narrow between
runs that hold still, so it does not slip from one into the next.
