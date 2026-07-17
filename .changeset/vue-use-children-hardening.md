---
'@placement/vue': patch
---

Harden child collection. Children inside `KeepAlive` now leave the layout on
deactivate and rejoin on activate, even when the provider itself never
re-renders. Input changes no longer trigger a redundant vnode-tree resolution
on the client, where the mappers' own reactive tracking already re-runs the
solve — the synchronous re-resolution now runs only during SSR, where it is
load-bearing. Dev builds warn when a mounted child cannot be reached from its
provider's vnode tree instead of silently dropping it from the layout.
