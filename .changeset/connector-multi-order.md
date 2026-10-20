---
'placement': patch
---

`Connector.apply` routes the edges in several orders and keeps the layout
that costs least as drawn: its length, its corners by how far they turn and
how much smaller than the edge's `radius` they are drawn, its crossings, how
far and how long its routes run closer together than the gap, the room its
notes of merged ends and adornments say they lacked, and its edges without a
route. The orders are its own canonical order, that order reversed, and the
best order so far with the edge that costs the most moved to the front, one
edge at a time. Ties keep the canonical order's layout, and the layout still
does not depend on the order of the edges or of the rects' keys. Routing
takes up to eight times as long as before.
