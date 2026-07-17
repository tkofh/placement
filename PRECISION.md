# Precision

How placement handles floating-point arithmetic. This is the reference for
the library's numerical contract; if a behavior contradicts this document,
one of the two is a bug. The model is adopted from
[curvy](https://github.com/tkofh/curvy)'s PRECISION.md, and the tolerance
primitives come from `curvy/number`.

## The model

Two rules apply everywhere:

1. **Constructions are exact IEEE 754.** No operation rounds, snaps, or
   otherwise post-processes its result: building a rect, translating an
   interval, resolving a flexbox layout, and interpolating dimensions all
   return exactly what the arithmetic produces. There is no stored
   `precision`, no per-constructor rounding, and no global tolerance state.
2. **Predicates are tolerance-aware.** The library never decides a discrete
   question about a computed value by raw comparison: equality, containment,
   and intersection are judged inside a tolerance band scaled to the data.

Rule 1 holds because construction error is harmless on its own terms: every
IEEE operation is exactly rounded, so a chain of arithmetic returns the exact
result for inputs a few ulps away. Defensive rounding (what this library did
before 0.4.0: `roundTo(value, 8)` in every constructor) only hides real
corruption under clean-looking values, and actively corrupts coordinates
above ~9e7, where `value * 1e8` exceeds 2^53.

Rule 2 exists because predicates are where rounding residue becomes a wrong
answer: cancellation manufactures values that sit within rounding distance of
a decision boundary, and a raw `===` lets the last bits pick the category.

Together the rules make every classification invariant under uniform scaling
of the input data: scale a layout by 1e6 and every `equals`, `contains`, and
`intersects` verdict is unchanged.

## The tolerance regimes

Every tolerant comparison in placement uses one of two scales, both from
`curvy/number`:

### 1. Identity of coordinates: the hybrid band

`coincident(a, b)` answers "are these the same coordinate?":

```
|a - b| <= EPSILON + RELATIVE_TOLERANCE * max(|a|, |b|)
```

with `EPSILON = 1e-10` and `RELATIVE_TOLERANCE = 1e-12`. The relative term
covers rounding noise, which grows with magnitude; the absolute term covers
the neighborhood of zero, where relative comparison degenerates. Built on
`coincident`: `equals` on `Interval`, `Point`, `Dimensions`, `Rect`,
`Offset`, and `Track` (per field), and the boundary comparisons inside
`contains` and `intersects`.

`coincident` is not transitive: chains of pairwise-coincident values can
drift beyond the band. That is fine for the identity questions placement
asks.

### 2. Degeneracy of distributed space: relative-only

The flexbox grow/shrink distributor divides free space among items in
proportion to their ratios, clamping at min/max constraints and iterating.
The mathematically-zero remainder after a distribution round is computed by
cancellation, so the loop treats any remainder smaller than
`RELATIVE_TOLERANCE` times the space it started with as consumed. Without
this, float dust can force an extra distribution round that assigns
subatomic sizes to items.

## What stays exact

- **Routing checks** make no semantic claim and stay raw: `direction <= 1`
  (row vs column), `wrap !== nowrap`, `Number.isFinite(value)` sentinel
  checks for `auto` offsets and inherited alignment. A value that is noise
  away from a sentinel takes the general path, which handles it anyway.
- **`Dimensions` taking `Math.abs` of its inputs** is a domain rule
  (dimensions are magnitudes), not defensive rounding: `abs` is exact.
- **Degenerate divisions** (`aspectRatio` of a zero-height dimensions,
  `scaleToWidth` of a zero-width dimensions) return what IEEE division
  produces: `Infinity` or `NaN`. Constructions do not invent fallback
  values.

## Working with the model

- Predicates that take a tolerance accept it per call; pass an explicit
  tolerance when your domain has a known resolution (e.g. device pixels,
  where anything under half a pixel is meaningless).
- To display or serialize values with bounded digits, round at the edge of
  your system with `round` from `curvy/number` — never inside layout math.
- When writing numerical tests, use dyadic values (integers, halves,
  quarters) for exactness assertions, and non-dyadic values (`0.1`,
  `k + 2.3`) to exercise rounding behavior. Uniform scaling of all inputs
  must never change a classification.
