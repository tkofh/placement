---
'placement': patch
---

`Connector.apply` keeps a route out of more of the places where nudging
would squeeze it beside a port leg. A leg that turns off a line it shares
with routes that cross it there now counts as reaching as far as nudging
can stretch it, so a route that leaves that line the other way, along the
leg, no longer ends up pinched between it and another leg. A narrow strip
beside a leg now counts the routes already in it, so a second route no
longer squeezes in where only one fits. And a route found again to keep out
of such a place, or to trade ports with another, is checked again, so that
its new route does not land in another one. Routing takes up to about a
fifth longer.
