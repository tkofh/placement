# placement

Layout algorithms for 2D graphics. pnpm + Turborepo monorepo publishing two
packages: `placement` (the vanilla core, `packages/placement`) and
`@placement/vue` (Vue 3 components/composables, `packages/vue`).
`apps/playground` is a private Nuxt app for eyeballing behavior.

## Commands

Repo root: `pnpm build` / `pnpm test` / `pnpm typecheck` / `pnpm bench` (turbo),
`pnpm check` (oxlint + oxfmt --check), `pnpm fix` (auto-fix both). Per package:
`pnpm build` (tsdown), `pnpm test` (vitest run), `pnpm typecheck` (tsc --noEmit).
Releases go through Changesets — see RELEASING.md; add a changeset with every
behavior-changing PR (`pnpm changeset`).

## Architecture (core)

Everything is an immutable, brand-symbol-tagged class exported **type-only**
and consumed through Effect-style namespace imports
(`import * as Interval from 'placement/interval'`): the factory is `make`
(`Interval.make(0, 100)`), constants and alternate constructors are plain
module exports (`Rect.zero`, `Rect.fromInterval`, `Point.fromPolar`), guards
keep full names (`Rect.isRect`), and types read as `Interval.Interval`.
Every class extends `Pipeable` from `curvy/utils`. Operations are standalone
`dual` functions (Effect-style data-first `op(self, ...)` / data-last
`self.pipe(op(...))`). The 1D core is
`Interval` (start/size); `Track` is a non-empty list of intervals plus the two
1D solvers (`sequence` = flexbox main axis, `stack` = cross axis); flexbox is
two tracks per line plus a track of lines. `Frame` is a flex-item spec,
`Flexbox` the container spec (solved by `Flexbox.apply`), and
`Rect`/`Point`/`Dimensions`/`Offset` the 2D value types. Type-only
cross-module imports may stay flat (`import type { Rect } from ...`);
namespace imports are for value usage.

**Dual-dispatch ambiguity rule**: an op may use a predicate dual
(`dual((args) => isX(args[0]), ...)`) with optional trailing args ONLY when the
data-last form's first argument can never be the self type. When the op's
target can itself be the self type (`alignTo`, `avoid`, track `remap`), the
arity is fixed and trailing args are required. Never declare an overload the
dispatcher cannot implement.

## Numerical contract

PRECISION.md is binding: constructions are exact IEEE 754 (no rounding, no
stored precision), predicates (`equals`, `contains`, `intersects`) are
tolerance-aware via `coincident`/`EPSILON`/`RELATIVE_TOLERANCE` from
`curvy/number`. Never add defensive rounding; never decide a discrete question
with raw float `===` unless it is a routing check or an identity returned by
`Math.min`/`Math.max`.

## Conventions

- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
  - `erasableSyntaxOnly` (no parameter properties/enums; `#private` fields ok)
  - `verbatimModuleSyntax`. Relative imports carry `.ts` extensions.
- oxlint + oxfmt (repo-root configs): `Array<T>` generics, no default exports
  (except configs/tests/benches/nuxt modules), camelCase filenames, single
  quotes, no semicolons, 100-column width.
- ESM-only publishing via tsdown; exports maps declare `types` before
  `import`; subpath exports only, no root entrypoint for the core package.
- Tests: vitest, table-driven `test.each` where natural. Dyadic inputs
  (integers, halves, quarters) assert exact structural equality; non-dyadic
  paths assert per-field closeness. Every dual op is tested in both forms.
- JSDoc on the public surface: `@param`/`@returns` on every function block,
  `@throws` in the form ``@throws `RangeError` when ...`` on verified
  consumer-reachable throws, verified `@example` blocks in `ts` fences,
  backticked prose cross-references (no `{@link}`), keyboard-charset formulas
  (`t^2`, `<=`). No `@since` tags in this repo.
- Angles are radians (atan2 convention). Y axis points down (SVG/screen
  space): `rect.top === rect.y`.
