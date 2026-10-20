---
'placement': patch
---

`Connector.apply` keeps, of the layouts it routes in several orders, one
whose routes that could merge run together as far as their directions
agree, and whose routes keep out of the fan of a node's ports. The score
it compares layouts by charges each route for the length it travels
apart from its merge partners, up to what the way their far ends lie
says they could share, at three quarters of a pixel per pixel. A
crossing near a route's port now costs up to three crossings, the extra
fading to nothing a fifth of the route's length from the port, and a
crossing near the ports of both its routes pays it for each. The side
search also finds a route again when it crosses another on a run they
share, which it used to count as no crossing, so an end no longer takes
a side whose route runs over another's on a shared line.
