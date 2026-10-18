---
'placement': minor
---

Add `placement/connector`, which routes edges between rects that are
already placed, around the other rects. `Connector.apply(rects, edges,
connector)` takes rects keyed by id (such as the `nodes` that
`Hierarchy.apply` returns), `Edge`s between them, and a `Connector` spec:
a `clearance` that routes keep from rects, a `gap` between routes that run
alongside each other, and a `bendCost` per corner, the one scale of every
cost: a crossing (a route running straight across another) costs two
fifths of it, and a corner against an edge's preferred turn as much again.
Omitted, the bend cost is twice the clearance and gap together, so the
costs scale with the room the routes keep. Each route is found among the routes
found before it, and each one that still crosses another is found again
among all the others; ports and merged lanes next to each other whose
routes cross trade places when that leaves fewer crossings. Routes are orthogonal, leave and enter
their ports straight out from the side, and report their corner `radii`.
Gaps are between strokes: `Edge` gains a `thickness` (and
`Edge.setThickness`), and routes sit their gap apart plus half of each
thickness, keep half their thickness more off the rects they run along
where they can, and keep inner corners at least half their thickness so
the inside of the stroke never folds.
Routes in a passage too narrow for the gap spread evenly across it, and
routes that turn together get corners about one center, as on a metro map.
An inner corner follows its outer one smoothly, down as a short leg holds
the outer one in, back up past their shared center and as a slanted jog
flattens it, and each
route's `insets` say how far inside the outermost corner of its nest each
corner sits.
An auto side is the side of the cheapest route, and auto ports that share a
side spread out in the order their routes part in, so that the routes nest
instead of crossing at the rect. Ports sit on the rects, or on the shapes
that `apply`'s `shapes` option gives them, as `Hierarchy.apply` takes
them. Ports that touch, where two rects meet, make a route of no length
that keeps both its ends. Each edge can also pass through `via` points,
each with the way the route arrives there (`arriving`) and leaves
(`leaving`) when it matters, and the routes beside such a point keep the
gap from it; stay out of its own `avoid` rects; and prefer clockwise or
counterclockwise turns. Nudging never takes a waypoint off its route, and
a segment that moves takes the open side of one that stays put on the
line of a wall. A jog, the rise of a Z-shaped route, sits at the
spec's `jogAt` of the run it shifts (the middle by default, or per edge),
and passes routes that run alongside all of it, since that adds no
crossing. A jog too short for its two corners slants into an S (two arcs
that meet halfway) instead of shrinking them into a kink, as far as the
spec's `jogSlant` and the free length around it allow, so a route's
`points` may include one slanted segment per such jog. Routes place their
edges' adornments. Each straight run lays out
its `flow` adornments like a flex container with no thickness: packed
against the port at either end, otherwise on the nearest stretch of a run
where no other route comes within the `gap` of them, or failing that on the
run nearest where they fall that has room for them and its corners, justified by
`justifyAdornments`, `justifyAdornmentsSpace`, and
`justifyAdornmentsSpaceOuter`, `adornmentGap` apart, and aligned across the
line by `alignAdornments`, with corners kept clear of them. `absolute`
adornments sit on the route as drawn.
With the spec's `merge` set to `side` or `near`, ends on one side of a rect
that carry the same adornments there merge: they share one port and one
copy of the adornments. Their routes come in on lanes whose strokes are
`mergeGap` apart (`gap` by default) and step onto the line out of the port
on arcs that leave the merge gap inside them, meeting right behind the
adornments; the lanes on
one side meet the line on the same circle, so they peel off one another
like a whisk. Back from the merge, the routes stay the merge gap apart
for as long as they run alongside each other, turning the same ways, and
their jogs sit beside one another rather than at `jogAt`, so they turn
together as one bundle with nested corners. Other routes never run inside
a bundle: they go past it, and a route whose port leaves it among the lanes
steps out past them once it clears its rect. A route parts from its bundle
as far from the merge as its corners leave room for. Routes whose ends at one rect could
merge pull each other along while sides are chosen, so they come in
on one side and merge (a tenth less along a partner's route). Where a route goes
on alone from a group that goes on without it, it turns as tight as the
merge gap allows; a pair that parts leaves no group, and turns as usual.
A short jog right past an auto port slides the port along its side to
straighten the route where it can, and a slanted jog keeps its curve the
gap from the routes and rects beside it. Jogs in a bundle, or where a
route leaves a group, stay upright. Merged lanes stop short of a far end
that faces them close by, so no route has to turn back past them. `near` merges
only ends whose routes come in from the same way, and each route's
`merged` names the edge that draws the shared adornments.
`AdornmentPlacement` in `placement/adornment` is the shape that both
layouts report placed adornments in.
The layout's `notes` say what the routes gave up, and what would have fit
them, for a caller or a layout that places the rects to act on: an edge
with no route, a channel too narrow for the gaps of the routes in it (with
the rects on either side and how much more room they need between them),
a merge with no room in front of its side for its lanes, and a flow
adornment longer than every run of its route.
