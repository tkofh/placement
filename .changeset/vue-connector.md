---
'@placement/vue': minor
---

Add `ConnectorLayout`, `ConnectorNode`, `ConnectorEdge`, and
`ConnectorAdornment`, the Vue layer for `placement/connector`: orthogonal
routes between boxes that are already placed, around the others.

- `ConnectorLayout` takes the spec as props (`clearance`, `gap`,
  `bendCost`, `turnCost`, `alignAdornments`, `justifyAdornments` in the
  `justifyContent` form, `adornmentGap`, `jogAt`, and `jogSlant`) or a
  prebuilt `layout`. Corners grow to fill the room the layout gives them,
  so a slanted jog draws as a smooth S. It is
  a box like `GraphicGroup`, filling its parent by default, and routes in
  the coordinates that its descendants' rects resolve in.
- `ConnectorNode` registers its box, which fills its parent by default, so
  wrapping the content of a flex item, a hierarchy node, or a group makes
  that box a node. Its `id` is what edges reference. A node without one is
  an obstacle that routes go around.
- `ConnectorEdge` takes `from`, `to`, `fromPort`, `toPort`, `via`, `turn`,
  `jogAt`, `r`, `smoothing`, and paint props, and draws its route as a path, with
  corners rounded within the sizes the layout solved.
- `ConnectorAdornment` decorates an edge with the props of
  `HierarchyAdornment`. At `'start'` or `'end'`, it packs against the node
  and trims the drawn line, as an arrowhead needs.

Edges that name a missing node, nodes that share an id, and edges that no
route connects draw nothing, with a warning in development.
