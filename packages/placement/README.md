# placement

Layout algorithms for 2D graphics: flexbox, 1D tracks, and a toolkit of
immutable geometric value types. Framework-agnostic — bring your own renderer
(SVG, canvas, WebGL). `@placement/vue` wraps it for Vue 3.

```sh
pnpm add placement
```

## Flexbox in five lines

```ts
import { applyFlexbox, direction, flexbox } from 'placement/flexbox'
import { frame } from 'placement/frame'
import { rect } from 'placement/rect'

const rects = applyFlexbox(
  [frame({ width: 100, height: 100 }), frame({ width: 100, height: 100, grow: 1 })],
  flexbox({ direction: direction.row, columnGap: 10 }),
  rect(400, 200),
)
// [Rect (0, 0) 100x100, Rect (110, 0) 290x100]
```

A `Frame` describes one item (sizing, min/max, grow/shrink, margins as
offsets, alignment), a `Flexbox` describes the container, and `applyFlexbox`
returns one `Rect` per frame, positioned inside the parent rect. Wrapping,
reverse directions, gaps, `alignContent`/`alignItems`/`justifyContent`, and
auto margins (pass `Infinity` as an offset) all behave like their CSS
namesakes.

## The pieces underneath

Flexbox is two 1D solvers composed. They are exported, and they are often what
you actually want:

```ts
import { sequence } from 'placement/track'

sequence([{ basis: 100 }, { basis: 100, grow: 1 }], { size: 400, gap: 10 })
// Track [[0, 100], [110, 400]]
```

- `placement/track` — `sequence` lays items end to end (the flexbox main
  axis: definite sizes, gaps, grow/shrink distribution, spacing); `stack`
  overlaps them in one span (the cross axis: per-item alignment and stretch).
  Both return a `Track`, a list of intervals you can `translate`, `scale`,
  `lerp`, or `remap` as one unit.
- `placement/interval` — 1D span (`start`, `size`) with the full toolkit:
  `alignTo`, `avoid`, `join`, `intersect`, `contains`, `lerp`, `remap`, …
- `placement/rect`, `placement/point`, `placement/dimensions`,
  `placement/offset` — the 2D value types, each with the operations its shape
  implies (`rect` alone has ~40, from `alignX` to `cover` to `contract`).

Every type is immutable and every operation is a small pure function with two
call forms — data-first, or data-last for pipelines:

```ts
import { pipe } from 'placement/utils'
import { interval, setSize } from 'placement/interval'

setSize(interval(0, 100), 50, 0.5) // Interval [25, 75]
pipe(interval(0, 100), setSize(50, 0.5)) // same
interval(0, 100).pipe(setSize(50, 0.5)) // same
```

## Numerical contract

Constructions are exact IEEE 754 — no rounding, no snapping, no stored
precision. Predicates (`equals`, `contains`, `intersects`) are
tolerance-aware, scaled to the data, so `0.1 + 0.2` compares equal to `0.3`
at any magnitude. The full contract lives in
[PRECISION.md](https://github.com/tkofh/placement/blob/main/PRECISION.md);
the tolerance primitives come from [curvy](https://github.com/tkofh/curvy)'s
`curvy/number`.

Coordinates are y-down (screen/SVG space): `rect.top === rect.y`. Angles are
radians.

## Entry points

`placement/dimensions` · `placement/flexbox` · `placement/frame` ·
`placement/interval` · `placement/offset` · `placement/point` ·
`placement/rect` · `placement/track` · `placement/utils`

ESM only. Every export carries JSDoc — the types are the reference docs.

## License

MIT
