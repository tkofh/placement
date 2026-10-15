# placement

Layout algorithms for 2D graphics: flexbox, absolute positioning, 1D tracks,
and a set of immutable geometric value types. The library is
framework-agnostic, so you bring your own renderer (SVG, canvas, WebGL).
`@placement/vue` wraps it for Vue 3.

```sh
pnpm add placement
```

## Flexbox in five lines

```ts
import * as Flexbox from 'placement/flexbox'
import * as Frame from 'placement/frame'
import * as Rect from 'placement/rect'

const rects = Flexbox.apply(
  [Frame.make({ width: 100, height: 100 }), Frame.make({ width: 100, height: 100, grow: 1 })],
  Flexbox.make({ direction: Flexbox.direction.row, columnGap: 10 }),
  Rect.make(400, 200),
)
// [Rect (0, 0) 100x100, Rect (110, 0) 290x100]
```

A `Frame` describes one item: sizing, min/max, grow/shrink, margins as
offsets, and alignment. A `Flexbox` describes the container. `Flexbox.apply`
returns one `Rect` per frame, positioned inside the parent rect. Wrapping,
reverse directions, gaps, `alignContent`/`alignItems`/`justifyContent`, and
auto margins (pass `Infinity` as an offset) all behave like their CSS
namesakes.

## Absolute positioning

`Box` is the positioned counterpart to `Frame`. It holds insets, sizing, and
constraints, and `Box.apply` solves them against any parent rect.

```ts
import * as Box from 'placement/box'

Box.apply(Box.make({ right: 10, bottom: 10, width: 100, aspectRatio: 2 }), Rect.make(400, 200))
// Rect (290, 140) 100x50
```

An explicit size wins. An inset pair determines an unset dimension. An
`aspectRatio` derives one undetermined axis from the other. An axis that is
still undetermined fills the parent minus the set insets. Every size clamps to
the min/max constraints (the minimum wins, as in CSS `clamp()`). A box anchors
to `left`/`top` when set, else to `right`/`bottom` measured with the used
size. The result is CSS absolute positioning without a DOM.

## The pieces underneath

Flexbox composes two 1D solvers. The package exports both, and often they are
what you need:

```ts
import * as Track from 'placement/track'

Track.sequence([{ basis: 100 }, { basis: 100, grow: 1 }], { size: 400, gap: 10 })
// Track [[0, 100], [110, 400]]
```

- `placement/track` has `sequence`, which lays items end to end (the flexbox
  main axis: definite sizes, gaps, grow/shrink distribution, spacing). It also
  has `stack`, which overlaps items in one span (the cross axis: per-item
  alignment and stretch). Both return a `Track`, a list of intervals that you
  can `translate`, `scale`, `lerp`, or `remap` as one unit.
- `placement/interval` is the 1D span (`start`, `size`) with the full set of
  operations: `alignTo`, `avoid`, `join`, `intersect`, `contains`, `lerp`,
  `remap`, and more.
- `placement/rect`, `placement/point`, `placement/dimensions`, and
  `placement/offset` are the 2D value types. Each has the operations its shape
  implies (`rect` alone has ~40, such as `alignX`, `cover`, and `contract`).

Every type is immutable. Every operation is a small pure function with two
call forms, data-first and data-last (for pipelines):

```ts
import * as Interval from 'placement/interval'

Interval.setSize(Interval.make(0, 100), 50, 0.5) // Interval [25, 75]
Interval.make(0, 100).pipe(Interval.setSize(50, 0.5)) // same
```

## Numerical contract

Constructions are exact IEEE 754, with no rounding, no snapping, and no
stored precision. Predicates (`equals`, `contains`, `intersects`) are
tolerance-aware and scaled to the data, so `0.1 + 0.2` compares equal to `0.3`
at any magnitude. The full contract is in
[PRECISION.md](https://github.com/tkofh/placement/blob/main/PRECISION.md).
The tolerance constants and functions come from `curvy/number` in
[curvy](https://github.com/tkofh/curvy).

Coordinates are y-down (screen/SVG space): `rect.top === rect.y`. Angles are
radians.

## Entry points

`placement/box` · `placement/dimensions` · `placement/flexbox` ·
`placement/frame` · `placement/interval` · `placement/offset` ·
`placement/point` · `placement/rect` · `placement/track`

The package is ESM only. Every export has JSDoc, and the types are the
reference docs.

## License

MIT
