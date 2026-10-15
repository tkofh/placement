---
'placement': minor
'@placement/vue': patch
---

Add `placement/unstable/utils`, which exports `auto`, the resolver for the
`Infinity`-as-auto sentinels. It returns the first finite candidate, or the
last candidate when none is finite. The subpath is not covered by semver.
`@placement/vue` now imports `auto` from it instead of keeping its own copy.
