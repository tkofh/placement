---
'@placement/vue': minor
---

Add `HierarchyLayout`, `HierarchyNode`, `HierarchyEdge`, and `HierarchyAdornment`,
the Vue layer for `placement/hierarchy` flowcharts and other directed
diagrams.

- `HierarchyLayout` takes the spec as props (`direction`, `backEdges`,
  `rankGap`, `nodeGap`, `edgeGap`, `alignItems`, `alignAdornments`) or a
  prebuilt `layout`.
  The drawing has its own size, so the inset and transform props only
  position it (`left="50%" top="50%" origin="center"` centers it).
- `HierarchyNode` takes an `id` plus the sizing, margin, and `alignSelf`
  props of `FlexItem`. Its percentages resolve against the layout's parent,
  because the layout's own size depends on its nodes. A `GraphicRect` or
  `GraphicPolygon` that fills a node gives it the outline its edges meet,
  so that they touch a diamond's rounded tips or a rounded rect's curve
  rather than the bounding box.
- `HierarchyEdge` references nodes with `from` and `to`, sets ports with
  `fromPort`/`toPort` (`'right'`, `'25%'`, or `'right 25%'`), and takes
  `weight` and `minLength`. It draws its route as a path with the paint
  props, and passes other attributes through to it. `r` and `smoothing`
  round its corners to the sizes the layout solves, which shrink where the
  route is crowded, and `minR` sets the least radius the layout keeps room
  for. The inner corners of routes that turn together draw as their
  outermost corner moved in, so smoothed corners keep one center. Its slot
  receives the route's `points` and corner `radii`.
- `HierarchyAdornment` children decorate an edge. `at` places one along it
  (`'start'`, `'end'`, `'center'`, or a ratio), and `position="flow"` (the
  default) keeps it on a straight run that the layout makes long enough,
  where adornments in the same `layer` line up one after another and their
  margins keep them and the corners apart. `position="absolute"` sits it on
  the drawn line at `at`, corners included, without room. `orient` turns it
  with the line (`'forward'`, `'backward'`), keeps it upright (`'none'`), or
  by default faces it into the node at `'start'` and `'end'`, which draws
  arrowheads without SVG `<marker>`s. The edge's line stops where its
  `'start'` and `'end'` adornments begin.

Nodes and edges register in any order and may sit inside other elements. An
edge that names a missing node, and a node whose id is missing or already
taken, is left out of the layout with a dev warning instead of throwing.
