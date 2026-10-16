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
counterclockwise turns. Routes place their edges' adornments (`flow` ones
on the straight run where they fall, packed against the port at either
end, with corners kept clear of them; `absolute` ones on the route as
drawn), and the spec's `alignAdornments` picks their side of the line.
`AdornmentPlacement` in `placement/adornment` is the shape that both
layouts report placed adornments in.
