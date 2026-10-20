---
'placement': patch
---

`Connector.apply` no longer swells a corner to match a gentle slanted jog it
sits inside, far past its `radius`, and no longer leaves the corner before
it sharp to make room. A corner inside a slanted jog grows toward the jog's
arc only while that growth stays within both edges' radii together, by less
as it nears that, and never into the `radius` of the corner at the other end
of its leg.
