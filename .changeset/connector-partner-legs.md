---
'placement': patch
---

`Connector.apply` keeps a route out of more of the narrow places beside
port legs. A run that turns onto such a place and off it again, with no
bend point between, used to cost nothing there, so a route could still
lie a pixel or two from a leg, against an obstacle, and be squeezed by
the nudge. It now counts like a run straight through. And the legs of
routes in one group now hold the others off once they part: only the
leg out of the shared port or group lets them run at the merge gap. A
route that would part under its partner's leg into another rect now parts
first and crosses the leg instead. Where the way around such a place is
short, a route now takes it. Routing takes up to about a tenth longer.
