---
'@placement/vue': patch
---

Harden child collection. Children inside `KeepAlive` now leave the layout on
deactivate and rejoin on activate, even when the provider itself never
re-renders. On the client, input changes no longer trigger a redundant
vnode-tree resolution, because the reactive tracking of the mappers already
re-runs the solve. The synchronous re-resolution now runs only during SSR,
where it is required. If a mounted child is not reachable from the
vnode tree of its provider, dev builds warn instead of silently dropping the
child from the layout.
