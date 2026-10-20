---
'placement': patch
---

`Connector.apply` gives each auto end a weak preference for the side of
its rect that faces where its network comes from: the mean of the centers
of the rects at the far ends of the edges that enter the rect, for a
target end, or that leave it, for a source end. A side costs up to a
quarter of a corner by how far it turns from that direction. The cost
settles near-ties, so the routes of a network come in, or leave, on one
side, and it never turns a route the long way round.
