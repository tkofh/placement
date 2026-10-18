---
'placement': minor
---

Add `placement/hierarchy`, `placement/edge`, and `placement/adornment`, a
layered (Sugiyama-style) graph layout for flowcharts and other directed
diagrams, as a peer of `Flexbox` and `Box`. `Hierarchy.apply(frames, edges,
spec)` takes an array of `Frame`s with ids, and `Edge` specs that reference
those ids. The types check the references: an edge to an unknown id, or a
frame without an id, is a compile error. It returns a record of rects keyed
by id, a route per edge, and the bounds of the drawing. The solver breaks
cycles, ranks nodes by network simplex, reduces crossings by barycenter
sweeps, and assigns coordinates by Brandes-Köpf with an edge-straightening
pass. It is deterministic, and ties follow input order.

The layout places the nodes and `Connector.apply` (see
`placement/connector`) routes the edges around them, so the two layouts
draw edges the same way. Routes are orthogonal: every segment runs along
or across the flow. An edge that shifts across the flow does so on a jog
between two ranks, in the middle of the gap, and jogs that share the gap
sit `edgeGap` apart, in the order that avoids crossings. An edge that
leaves through a node's side, or around it from the side facing away,
runs in a column of its own beside the node, and the layout reserves room
for it. Where the routes still find a channel between two ranks, or the
room between two nodes of a rank, too narrow for their gaps, the layout
grows it by what they need and places and routes again, up to two more
times, and the layout's `notes` report what the routes gave up after
that, as `Connector.apply` reports it.

Back edges (the edges reversed to break cycles) run straight back against
the flow by default. With `backEdges: Hierarchy.backEdges.loop`, they leave
the source downstream and loop around into the target from upstream, as
flowcharts often draw loops.

Edges carry a `weight`, a `minLength`, ports (`sourceSide`/`sourceAt`,
`targetSide`/`targetAt`, each auto when omitted), corner sizes, and
adornments. A route reports how far each of its corners reaches
(`radii`): the edge's `radius` at least, more where routes turn together
and nest about one center, and less only where a run across the flow is
short or an adornment sits close, and how far outside the innermost
corner of its nest each corner sits (`outsets`). The layout keeps room for
corners of the edge's `radius` along the flow and out of each port.

An `Adornment` is a `Frame` that decorates an edge, such as a label or an
arrowhead, placed at `at` along it and turned to face along the line or
kept upright. A `flow` adornment (the default) sits on a straight run,
never on a corner: at `at` `0` or `1` it packs against the port, and the
route runs straight out of the port as far as the adornments there take
and an edge gap more; otherwise it sits on the run nearest `at` with room
for it, and a rank between the nodes grows to hold the adornments of the
edges through it. Adornments in the same `layer` line up one after
another like flex items, with their margins as gaps. An `absolute`
adornment sits at `at` of the way along the route as drawn, with its
rounded corners, and takes no room. Each route reports where its
adornments landed and the stretch of the route each covers.

Ports sit on each node's rect by default. `apply`'s fourth argument takes
`shapes`, a `Polygon` per frame id, so that ports sit on a node's shape
instead: edges meet a diamond (`Polygon.make({ phase: 0.5 })`) at its tips
and on its slopes, and a rounded rect on its curve. Shapes only move ports.
The layout still spaces nodes by their rects. A side port needs a
`nodeGap` or an `edgeGap` to leave room beside its node for the route to
turn in.

Nodes stack within their rank by the frames' `align` and `stretch`.
`Hierarchy.make` configures the flow `direction`, the `backEdges` style,
the `rankGap`/`nodeGap`/`edgeGap` spacing, and the
`alignItems`/`stretchItems`/`alignAdornments` defaults.
