# placement

Layout algorithms for 2D graphics. This is a pnpm and Turborepo monorepo that
publishes two packages: `placement` (the vanilla core, `packages/placement`)
and `@placement/vue` (Vue 3 components and composables, `packages/vue`).
`apps/playground` is a private Nuxt app to look at behavior visually.

## Commands

At the repo root, `pnpm build`, `pnpm test`, `pnpm typecheck`, and
`pnpm bench` run through turbo. `pnpm check` runs oxlint and `oxfmt --check`,
and `pnpm fix` auto-fixes both. In each package, `pnpm build` runs tsdown,
`pnpm test` runs `vitest run`, and `pnpm typecheck` runs `tsc --noEmit`.
Releases go through Changesets (see RELEASING.md). Add a changeset with every
PR that changes behavior (`pnpm changeset`).

## Architecture (core)

Everything is an immutable class tagged with a brand symbol. Each class is
exported type-only and consumed through Effect-style namespace imports
(`import * as Interval from 'placement/interval'`):

- The factory is `make` (`Interval.make(0, 100)`).
- Constants and alternate constructors are plain module exports (`Rect.zero`,
  `Rect.fromInterval`, `Point.fromPolar`).
- Guards keep full names (`Rect.isRect`).
- Types read as `Interval.Interval`.

Every class extends `Pipeable` from `curvy/utils`. Operations are standalone
`dual` functions: Effect-style data-first `op(self, ...)` and data-last
`self.pipe(op(...))`. The 1D core is `Interval` (start/size). `Track` is a
non-empty list of intervals plus the two 1D solvers (`sequence` is the flexbox
main axis, `stack` is the cross axis). Flexbox is two tracks per line plus a
track of lines. `Frame` is a flex-item spec. `Flexbox` is the container spec,
and `Flexbox.apply` solves it. `Box` is a positioned-box spec (CSS absolute
positioning). `Box.apply` solves it against a parent rect, and every
non-finite input acts as unset. `Hierarchy` is a layered graph layout spec.
`Hierarchy.apply` solves `Frame`s with ids plus `Edge` specs (which
reference frame ids and carry `Adornment`s), with optional `Polygon` node
shapes that ports sit on, through the phases in
`internal/hierarchy/`: acyclic, rank (network simplex), order, position
(Brandes-Köpf), and layout (bands, ports, routes). `lanes.ts` orders the jogs
and U-turns of orthogonal routes, and `adornments.ts` packs adornments onto
straight runs and sizes corners. `Polygon` is a regular or star polygon that fills a rect, and
`Polygon.apply` places it, growing a rounded one so that its rounded
outline fills the rect (`internal/polygon.ts`, shared with the hierarchy
ports). `internal/graph/` holds the graphs of points that the connector
router builds on (not yet public): `graph.ts` stores them in flat arrays,
`visibility.ts` builds the orthogonal visibility graph of obstacles and pins,
and `search.ts` finds the cheapest path for length and turns (A\*);
`acyclic.ts` breaks cycles and orders pairwise preferences for both
routers. `internal/connector/nudge.ts` moves overlapping route segments
apart with `internal/separation.ts`, a 1D separation-constraint solver
(VPSC). `Rect`,
`Point`, `Dimensions`, and `Offset` are the 2D value types. Type-only cross-module imports can stay flat
(`import type { Rect } from ...`). Use namespace imports for value usage.

Follow the dual-dispatch ambiguity rule. An op can use a predicate dual
(`dual((args) => isX(args[0]), ...)`) with optional trailing args ONLY when
the first argument of the data-last form can never be the self type. When the
target of the op can itself be the self type (`alignTo`, `avoid`, track
`remap`), the arity is fixed and trailing args are required. Never declare an
overload that the dispatcher cannot implement.

## Numerical contract

PRECISION.md is binding. Constructions are exact IEEE 754 (no rounding, no
stored precision). Predicates (`equals`, `contains`, `intersects`) are
tolerance-aware through `coincident`/`EPSILON`/`RELATIVE_TOLERANCE` from
`curvy/number`. Never add defensive rounding. Never decide a discrete question
with raw float `===`, unless it is a routing check or an identity returned by
`Math.min`/`Math.max`.

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `erasableSyntaxOnly` (no parameter properties or enums, `#private` fields
  are ok), and `verbatimModuleSyntax`. Relative imports carry `.ts`
  extensions.
- oxlint and oxfmt use the configs at the repo root. Use `Array<T>` generics,
  no default exports (except configs, tests, benches, and nuxt modules),
  camelCase filenames, single quotes, no semicolons, and a 100-column width.
- Publishing is ESM-only through tsdown. Exports maps declare `types` before
  `import`. The core package has subpath exports only and no root entrypoint.
- Tests use vitest, with table-driven `test.each` where natural. Dyadic inputs
  (integers, halves, quarters) assert exact structural equality. Non-dyadic
  paths assert closeness per field. Test every dual op in both forms.
- Put JSDoc on the public surface:
  - `@param`/`@returns` on every function block.
  - `@throws` in the form ``@throws `RangeError` when ...`` on verified throws
    that a consumer can reach.
  - Verified `@example` blocks in `ts` fences.
  - Backticked prose cross-references (no `{@link}`).
  - Formulas in keyboard charset (`t^2`, `<=`).
  - No `@since` tags in this repo.
- Angles are radians (atan2 convention). The Y axis points down (SVG/screen
  space): `rect.top === rect.y`.
