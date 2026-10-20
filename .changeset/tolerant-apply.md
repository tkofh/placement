---
'placement': minor
'@placement/vue': patch
---

Add `Hierarchy.applyTolerant` and `Connector.applyTolerant`, which lay out
a graph as `apply` does but report bad input instead of throwing on it.
They take nodes as a list, each with an optional id, so ids may be missing
or repeated, and return each node's rect and each edge's route in input
order, `undefined` for what they left out. Each node or edge left out is a
problem in the result's `problems`: a node without an id (hierarchy only),
a node whose id an earlier node took, or an edge that names an id no node
has. The kinds are numbers in `problem`, which both modules share. The
connector keeps a node without an id, or with a taken one, as an obstacle.
The `notes` and each route's `merged` name edges by their index in the
input.

`@placement/vue`'s hierarchy and connector layouts now solve through these,
with no change in behavior or in the dev warnings.
