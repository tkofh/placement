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
shapes that ports sit on. `internal/hierarchy/layout.ts` places the nodes
through the phases in `internal/hierarchy/`: acyclic
(`internal/graph/acyclic.ts`), rank (network simplex), order, position
(Brandes-Köpf), and `place` (bands, channels, ports, the straight runs out
of ports, and the waypoints through the slots that ordering reserved).
`hierarchy.ts` then routes the edges with `Connector.apply`, reads its
`notes`, grows the channels and the room between nodes they name
(`Growth`), and places again, up to three rounds. `internal/adornments.ts`
(shared with the connector) measures adornments and sizes corners. `Polygon` is a regular or star polygon that fills a rect, and
`Polygon.apply` places it, growing a rounded one so that its rounded
outline fills the rect (`internal/polygon.ts`, shared with the hierarchy
ports). `Connector` is a routing spec, and `Connector.apply` routes `Edge`s
between rects that are already placed, keyed by id, around the others, and
reports in `notes` what the routes gave up and what would have fit them.
`apply` is `solve(normalize(...))`: `internal/connector/problem.ts` turns
the inputs into a `Problem` (rects grown into obstacles, the shapes their
ports sit on, edges with their ends, waypoints with the ways a route
arrives and leaves, costs, and resolved adornments), and `internal/connector/pipeline.ts`
runs the phases, each a function of the problem and the phases before it:
`sides.ts` picks the sides of auto ends by a trial search (a side with no
room in front of its port for the end's adornments and corner costs more,
and routes that could merge pull each other along within the span of
their own rects, in rounds after a first one without the pull, against
the price of channels over capacity, as in `routing.ts`),
`spread.ts`
spreads auto ports along shared sides and groups the ends that merge,
`merge.ts` plans the lanes and whisks of merges, `routing.ts` finds the
routes (a run that waypoints hold goes around the port legs of other
routes, and so does a run along or beside one where a wall leaves nudging
no room to move it off, and one that nudging would hold between two held
runs, or one and a wall, too close for it, and a run shared with an earlier route and left
on its other side counts as the crossing it is; a channel too narrow for
its routes costs more by how far over it is, in rounds of rising
pressure that move the route that gains most first, so the routes with
another way leave it) and trades ends that
cross, `nudge.ts` moves overlapping segments
apart (with `internal/separation.ts`, a 1D separation-constraint solver,
VPSC) and keeps other routes out of merged bundles (a segment beside a
kink too short for its corners stays put, as does a kink a port will
slide away), `ports.ts` slides auto
ports to straighten short jogs, `adornments.ts` places adornments on the
routes, `corners.ts` sizes corners (the edge's radius is the least a corner
turns, and the corners of routes that turn together grow outward from the
innermost to share a center), and `slants.ts` turns jogs too short for
their corners into S curves. `route.ts` is the polyline those passes read, with
its lengths, headings, and segment boxes worked out once. `locks.ts`
carries what a pass decided to the
passes after it (upright jogs, set corner sizes), so the
order of `solve` is the order in which decisions yield. The phases build
on `internal/graph/` (not yet public): `graph.ts` stores graphs of points
in flat arrays, `visibility.ts` builds the orthogonal visibility graph of
obstacles and pins, `search.ts` finds the cheapest path for length, turns,
and crossings (A\*; a jog shorter than twice the edge's radius costs its
two turns in proportion, and a run left on the other side from where it
was joined crosses the paths along it), for less along partner paths,
for more through channels over capacity, between sets of endpoints, and
routes several paths among one another, `channels.ts` groups the
half-edges between one pair of walls into the slots those prices read
and keeps what the routes fill of them, a merged bundle as one out of
its shared port,
`crossings.ts`
counts the crossings between two paths, shared runs included, and
`acyclic.ts` breaks cycles and orders pairwise preferences for both
routers. `internal/orient.ts` is the shared vocabulary of axes, sides, and
segments (`XY`, `Axis`, `lo`/`hi` of a box on an axis, `segmentBox`,
`headingOf`, `turnOf`), and `utils/tolerance.ts` holds the tolerant
ordering predicates (`before`, `atMost`, `within`, `inside`, `overlaps`,
`touches`) that every discrete geometric decision goes through. `Rect`,
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
