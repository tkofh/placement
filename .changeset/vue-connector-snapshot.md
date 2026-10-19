---
'@placement/vue': minor
---

`ConnectorLayout` exposes `snapshot()`, which returns the problem the
layout last routed as plain JSON (`ConnectorScene`): the spec, the node
rects by id, the edges with their adornments, and each edge's route
constraints, with every class reduced to the fields its `make` takes and
unset or non-finite fields left out. `useConnectorLayout` returns the same
`snapshot`. Reach it through a template ref typed `ConnectorLayoutExposed`.
