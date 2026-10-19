---
'placement': patch
---

`Connector.apply` closes three gaps in how the route search counts
crossings. A route no longer jogs onto its own lane, or its own port's
line, at the last moment to keep out of the strip beside another route's
port leg: where the ports sit, and how close the lanes of two merges lie,
is not the search's to change, so those lines cost it nothing there. A
route that runs straight across the end of another route now crosses it,
since the port or the lane's whisk past the end goes on the way the route
arrives, so the column of a merge's lane ends is no longer a free corridor
that routes pile onto. And a route that steps off its line by a jog
shorter than twice its radius and later back onto the same line by
another pays for the crossings it stepped around, less those it made on
the way around, so weaving between two lines a pixel apart no longer
dodges crossings for the price of a few short jogs. A jog onto another
line for good still costs only its corners.
