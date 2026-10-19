---
'placement': patch
---

`Connector.apply` routes no longer depend on the order of the edges (with
their `options.edges`) or of the rects' keys. The connector solves the
edges in an order of its own, the edges between the rects nearest the
middle of the graph first, then by their ids and the rest of their specs,
and maps the layout back to the input order. An edge removed and added
back at the end routes as before, and parallel edges that differ keep
their own routes. Notes list their edges in ascending order, and the notes
of one kind go in the order of their edges.

Nudging also holds a segment to the room a waypoint leaves for its corner
when the segment starts at the edge of that room. Before, it could slip
past it and close up on a route beside it, short of the gap and without a
note. Where that room reaches into a rect's clearance, the clearance wins,
so no segment moves into a rect.
