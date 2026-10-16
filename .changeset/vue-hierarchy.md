---
'@placement/vue': minor
---

Add `HierarchyLayout`, `HierarchyNode`, `HierarchyEdge`, and `HierarchyLabel`,
the Vue layer for `placement/hierarchy` flowcharts and other directed
diagrams.

- `HierarchyLayout` takes the spec as props (`direction`, `routing`,
  `rankGap`, `nodeGap`, `edgeGap`, `alignItems`, `alignLabels`) or a
  prebuilt `layout`.
  The drawing has its own size, so the inset and transform props only
  position it (`left="50%" top="50%" origin="center"` centers it).
- `HierarchyNode` takes an `id` plus the sizing, margin, and `alignSelf`
  props of `FlexItem`. Its percentages resolve against the layout's parent,
  because the layout's own size depends on its nodes.
- `HierarchyEdge` references nodes with `from` and `to`, sets ports with
  `fromPort`/`toPort` (`'right'`, `'25%'`, or `'right 25%'`), and takes
  `weight` and `minLength`. It draws its route as a path with the paint props
  and a `curve` of `'linear'`, `'basis'`, or `'cardinal'`, and passes other
  attributes such as `marker-end` through to it. Its slot receives the
  route's `points`.
- `HierarchyLabel` children of an edge become labels that take up room in
  the layout, positioned along the edge by `at`.

Nodes and edges register in any order and may sit inside other elements. An
edge that names a missing node, and a node whose id is missing or already
taken, is left out of the layout with a dev warning instead of throwing.
