---
'placement': minor
'@placement/vue': patch
---

Merged ends in `Connector.apply` no longer share a port. Ends that merge
now group on ports next to each other, their strokes `mergeGap` apart, in
the order their routes part in, and their routes run together the merge
gap apart for as long as they run alongside each other. Each route draws
its own adornments, so `ConnectorRoute.merged` is always `[-1, -1]`. The
lanes, the steps onto a shared line, and the zones that kept other routes
out of them are gone.

The groups and the lone auto ports on a side spread along it with as much
free space between each two as at either end, so sides without groups
spread as before. A group pinned to one spot centers on it as far as the
side allows. A group too wide for its side packs its ports closer to fit,
and the `shared` note now reports how much longer the side would have to
be. The ports of a group slide along their side together, as one, to take
out a short jog right past one of them.

A slid port no longer stops for a route that lies wholly behind its leg,
and the `crowded` notes describe the routes as returned: a channel that
nudging crowds and then clears is no longer noted.

In `@placement/vue`, the docs of `ConnectorLayout`'s `merge` and
`mergeGap` describe grouped ends.
