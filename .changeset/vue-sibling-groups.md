---
'@placement/vue': patch
---

Fix sibling-group resolution in the children context. Sibling groups are now
one per enclosing element rather than one per nesting depth, so two containers
at the same depth no longer merge their children into a single group. A
child's ancestors now contain only earlier children from enclosing groups. As
a result `before()` and `after()` no longer leak children from sibling
subtrees, emit out-of-order results, or yield the child itself.
