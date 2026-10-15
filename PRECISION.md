# Precision

This document describes how placement handles floating-point arithmetic. It is
the reference for the numerical contract of the library. If a behavior
contradicts this document, one of the two is a bug. The model comes from the
PRECISION.md of [curvy](https://github.com/tkofh/curvy), and the tolerance
constants and functions come from `curvy/number`.

## The model

Two rules apply everywhere:

1. Constructions are exact IEEE 754. No operation rounds, snaps, or otherwise
   post-processes its result. Building a rect, translating an interval,
   resolving a flexbox layout, and interpolating dimensions all return exactly
   what the arithmetic produces. There is no stored `precision`, no
   per-constructor rounding, and no global tolerance state.
2. Predicates are tolerance-aware. The library never decides a discrete
   question about a computed value by raw comparison. It judges equality,
   containment, and intersection inside a tolerance band scaled to the data.

Rule 1 holds because construction error is harmless on its own terms. Every
IEEE operation is exactly rounded, so a chain of arithmetic returns the exact
result for inputs a few ulps away. Before 0.4.0, this library used defensive
rounding: `roundTo(value, 8)` in every constructor. Defensive rounding only
hides real corruption under clean-looking values. It also corrupts coordinates
above ~9e7, where `value * 1e8` exceeds 2^53.

Rule 2 exists because predicates are where rounding residue becomes a wrong
answer. Cancellation produces values that sit within rounding distance of a
decision boundary, and a raw `===` lets the last bits pick the category.

Together, the two rules make every classification invariant under uniform
scaling of the input data. If you scale a layout by 1e6, every `equals`,
`contains`, and `intersects` verdict stays the same.

## The tolerance regimes

Every tolerant comparison in placement uses one of two scales, both from
`curvy/number`:

### 1. Identity of coordinates: the hybrid band

`coincident(a, b)` answers the question "are these the same coordinate?":

```
|a - b| <= EPSILON + RELATIVE_TOLERANCE * max(|a|, |b|)
```

with `EPSILON = 1e-10` and `RELATIVE_TOLERANCE = 1e-12`. The relative term
covers rounding noise, which grows with magnitude. The absolute term covers
the neighborhood of zero, where relative comparison degenerates. These
comparisons use `coincident`: `equals` on `Interval`, `Point`, `Dimensions`,
`Rect`, `Offset`, and `Track` (per field), and the boundary comparisons inside
`contains` and `intersects`.

Non-finite fields compare exactly, not through the band. The band degenerates
at infinity: `|Inf - Inf|` is `NaN`, and any finite value lands within an
infinite band. For this reason, `equals` falls back to `===` when either field
is non-finite. An infinity equals only the same-signed infinity, and `NaN`
equals nothing. For the same reason, the boundary band inside
`contains`/`intersects`/`avoid` scales its relative term by the largest
_finite_ bound magnitude (zero when none is finite). A half-infinite extent
keeps a band scaled to its finite bound, and a fully infinite one falls back
to the absolute `EPSILON`.

`coincident` is not transitive. A chain of pairwise-coincident values can
drift beyond the band. This does not matter for the identity questions that
placement asks.

### 2. Degeneracy of distributed space: relative-only

The flexbox grow/shrink distributor divides free space among items in
proportion to their ratios. It clamps at min/max constraints and iterates.
After a distribution round, the remainder is mathematically zero, but the
distributor computes it by cancellation. So the loop treats any remainder
smaller than `RELATIVE_TOLERANCE` times its starting space as consumed.
Without this rule, float dust can force an extra distribution round that
assigns subatomic sizes to items.

The wrap decision has the same shape. Whether the accumulated item sizes of a
line exceed the main size of the container is a discrete classification over
a sum. For this reason, a line wraps only when the required size exceeds the
available size by more than the hybrid band. Three `0.1`-wide items fit a
`0.3`-wide container exactly as three `1`-wide items fit a `3`-wide one.

## What stays exact

- Routing checks make no semantic claim and stay raw: `direction <= 1` (row
  or column), `wrap !== nowrap`, and `Number.isFinite(value)` sentinel checks
  for `auto` offsets and inherited alignment. A value that is noise away from
  a sentinel takes the general path, which handles it anyway.
- `Dimensions` takes `Math.abs` of its inputs. This is a domain rule
  (dimensions are magnitudes), not defensive rounding, because `abs` is exact.
- Degenerate divisions (`aspectRatio` of a zero-height dimensions,
  `scaleToWidth` of a zero-width dimensions) return what IEEE division
  produces: `Infinity` or `NaN`. Constructions do not invent fallback values.

## Working with the model

- Predicates that take a tolerance accept it per call. If your domain has a
  known resolution, pass an explicit tolerance. For example, with device
  pixels, anything under half a pixel is meaningless.
- To display or serialize values with bounded digits, round at the edge of
  your system with `round` from `curvy/number`. Never round inside layout
  math.
- When you write numerical tests, use dyadic values (integers, halves,
  quarters) for exactness assertions. Use non-dyadic values (`0.1`,
  `k + 2.3`) to exercise rounding behavior. Uniform scaling of all inputs
  must never change a classification.
