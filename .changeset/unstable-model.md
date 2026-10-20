---
'placement': minor
---

Add `placement/unstable/model`, a typed live layout model. `Model.group`,
`Model.flex`, and `Model.item` build a tree of node specs, and `Model.store`
turns it into a store that places every node with `Box.apply` and
`Flexbox.apply`. A node's path joins the keys from the root with dots, and a
child without a key takes its position as its key. `store.get(path)` reads a
node's rect, and `store.subscribe(path, listener)` calls the listener once per
change. `store.subscribe(listener)` gets every change of a `mutate` at once.
`Model.mutate(store, (m) => ...)` applies `update`, `insert`, `remove`,
`setChildren`, and `setRoot` ops in one batch and returns the store typed for
the result. The checker rejects a path that is not in the model, an op that
does not fit the node, and an expected output the node cannot give. The
store checks the same at runtime before it writes anything. The subpath is not
covered by semver.

The core package now depends on `alien-signals`, which only this subpath
imports.
