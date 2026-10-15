---
'placement': minor
---

Add `placement/hierarchy` and `placement/edge`, a layered (Sugiyama-style)
graph layout for flowcharts and other directed diagrams, as a peer of
`Flexbox` and `Box`. `Hierarchy.apply(frames, edges, spec)` takes an array
of `Frame`s with ids, and `Edge` specs that reference those ids. The types
check the references: an edge to an unknown id, or a frame without an id, is
a compile error. It returns a record of rects keyed by id, a polyline route
per edge, and the bounds of the drawing. The solver breaks cycles, ranks
nodes by network simplex, reduces crossings by barycenter sweeps, and assigns
coordinates by Brandes-Köpf with an edge-straightening pass. It is deterministic, and ties follow input order.

Edges carry a `weight`, a `minLength`, ports (`sourceSide`/`sourceAt`,
`targetSide`/`targetAt`, each auto when omitted), and labels, which are
`Frame`s placed along the edge that take up room in the layout. Nodes stack
within their rank by the frames' `align` and `stretch`. `Hierarchy.make`
configures the flow `direction`, the `rankGap`/`nodeGap`/`edgeGap` spacing,
and the `alignItems`/`stretchItems`/`alignLabels` defaults.
