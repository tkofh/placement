---
'@placement/vue': patch
---

Fix sibling-group resolution in the children context. Each enclosing element
now has its own sibling group, instead of one group per nesting depth. Two
containers at the same depth no longer merge their children into a single
group. The ancestors of a child now contain only earlier children from
enclosing groups. As a result, `before()` and `after()` no longer leak
children from sibling subtrees, return results out of order, or yield the
child itself.
