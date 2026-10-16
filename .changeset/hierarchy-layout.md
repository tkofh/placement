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

Routes are orthogonal: every segment runs along or across the flow. An
edge that shifts across the flow does so on a jog between two ranks. Jogs
that share the space between two ranks get their own lanes, ordered to avoid
crossings, and that space grows to fit them. An edge that leaves through a
node's side, or around it from the side facing away, runs in a column of
its own beside the node, and the layout reserves room for it. A column
moves out to where its edge continues when nothing in the rank is in the
way, so the edge turns as few times as it can.

Back edges (the edges reversed to break cycles) run straight back against
the flow by default. With `backEdges: Hierarchy.backEdges.loop`, they leave
the source downstream and loop around into the target from upstream, as
flowcharts often draw loops.

Edges carry a `weight`, a `minLength`, ports (`sourceSide`/`sourceAt`,
`targetSide`/`targetAt`, each auto when omitted), corner sizes, and
adornments. A route reports how far each of its corners reaches
(`radii`): up to the edge's `radius`, shrinking where a leg is short or an
adornment sits close. The layout keeps room for corners of the edge's
`minRadius` along the flow and out of each port.

An `Adornment` is a `Frame` that decorates an edge, such as a label or an
arrowhead, placed at `at` along it and turned to face along the line or
kept upright. A `flow` adornment (the default) sits on the straight run
nearest `at`, never on a corner: the stub out of either port, which packs
it against the node, or the run through a rank between the nodes. The run
grows to fit its flow adornments, and the ones in the same `layer` line up
one after another like flex items, with their margins as gaps. An
`absolute` adornment sits at `at` of the way along the route as drawn, with
its rounded corners, and takes no room. Each route reports where its
adornments landed and the stretch of the route each covers.

Nodes stack within their rank by the frames' `align` and `stretch`.
`Hierarchy.make` configures the flow `direction`, the `backEdges` style,
the `rankGap`/`nodeGap`/`edgeGap` spacing, and the
`alignItems`/`stretchItems`/`alignAdornments` defaults.
