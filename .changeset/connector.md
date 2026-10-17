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
Routes in a passage too narrow for the gap spread evenly across it, and
routes that turn together get corners about one center, as on a metro map.
An auto side is the side of the cheapest route, and auto ports that share a
side spread out without crossing. Each edge can also pass through `via`
points, stay out of its own `avoid` rects, and prefer clockwise or
counterclockwise turns. A jog, the rise of a Z-shaped route, sits at the
spec's `jogAt` of the run it shifts (the middle by default, or per edge),
and passes routes that run alongside all of it, since that adds no
crossing. A jog too short for its two corners slants into an S (two arcs
that meet halfway) instead of shrinking them into a kink, as far as the
spec's `jogSlant` and the free length around it allow, so a route's
`points` may include one slanted segment per such jog. Routes place their
edges' adornments. Each straight run lays out
its `flow` adornments like a flex container with no thickness: packed
against the port at either end, otherwise on the run nearest where they
fall that has room for them and its corners, justified by
`justifyAdornments`, `justifyAdornmentsSpace`, and
`justifyAdornmentsSpaceOuter`, `adornmentGap` apart, and aligned across the
line by `alignAdornments`, with corners kept clear of them. `absolute`
adornments sit on the route as drawn.
`AdornmentPlacement` in `placement/adornment` is the shape that both
layouts report placed adornments in.
