---
'placement': minor
---

Add `placement/connector`, which routes edges between rects that are
already placed, around the other rects. `Connector.apply(rects, edges,
connector)` takes rects keyed by id (such as the `nodes` that
`Hierarchy.apply` returns), `Edge`s between them, and a `Connector` spec:
a `clearance` that routes keep from rects, a `gap` between routes that run
alongside each other, a `bendCost` per corner, and a `turnCost` for corners
against an edge's preferred turn. Routes are orthogonal, leave and enter
their ports straight out from the side, and report their corner `radii`.
An auto side is the side of the cheapest route, and auto ports that share a
side spread out without crossing. Each edge can also pass through `via`
points, stay out of its own `avoid` rects, and prefer clockwise or
counterclockwise turns.
