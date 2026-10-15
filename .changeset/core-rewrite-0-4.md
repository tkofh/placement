---
'placement': minor
---

Rewrite the core around an exact-arithmetic numerical contract and a redesigned API.

Precision changes (see PRECISION.md):

- Constructions are exact IEEE 754. The stored `precision` concept and per-constructor rounding are gone everywhere (factories, `rect.from*`, `setPrecision`, `precision` ops).
- Predicates are tolerance-aware instead. Every value type gains `equals`, and `Interval`/`Rect` gain `contains`/`intersects`. All of them scale to the data through `curvy/number`.
- `pipe`/`dual`/`Pipeable` now come from `curvy`, a new dependency.

Renames:

- The canonical style is now Effect-style namespace imports (`import * as Interval from 'placement/interval'`).
- Every factory is `make`. `Interval.make(0, 100)` replaces `interval(0, 100)`.
- Factory statics are plain module exports. `Rect.zero`, `Rect.fromInterval`, `Point.infinity`, and `Offset.xy` replace `rect.zero`, `point.infinity`, and the other statics.
- `applyFlexbox` is `Flexbox.apply`.
- The bare-noun setters of `dimensions` and `offset` are now `set*`.
- `mix`/`polarMix` are `lerp`.
- `frame.setSize`/`setMinSize`/`setMaxSize` take `(width, height?)`, with width first.
- `rect.shrinkByOffset`/`growByOffset` are `contract`/`expand`, and they accept plain numbers.
- `offset.invert` is `negate`.
- `frame.stretchCross` is `stretch`.
- The point `delta` is `subtract`, and the point getters `r`/`theta` are the `magnitude`/`angle` functions.
- Angles are radians (atan2 convention).

Removed:

- Offset's string-keyed `set()` and its 8 `min*`/`max*` ops.
- Rect's 8 `min*`/`max*` ops, fixed `align*` variants, `adjust*` family, and `setTop`/`setLeft` aliases.
- Dimensions' `scaleX`/`scaleY` and `aspectRatio.fixWidth`/`fixHeight`.
- Point's polar setters, corner ops, `arcLength`, and raw `r`/`theta`/`x`/`y` helpers.
- The unused `Frame.justify`/`stretchMain` options.
- The root entrypoint. The package has subpath exports only.
- The `placement/utils` subpath. `pipe`, `flow`, and `dual` come from `curvy/utils`, and every value has a `.pipe` method.
- CommonJS output. The package is ESM only.

Added:

- `interval` `join`/`intersect`/`min`/`max`.
- point `add`/`scale`/`min`/`max`.
- rect `lerp`/`scaleFrom`/`center`/`isRectLike`.
- `isPointLike`/`isDimensionsLike`.
- Exported `FrameInput`/`FlexboxInput`/`FlexDirection`/`FlexWrap`/`StackItem`/`SequenceItem` types.
- `flexbox.stretchItems` now works. It is the container default for per-item `stretch`, and an item inherits it through a non-finite sentinel.
- Frames keep unset sizing through setter chains.
- JSDoc on the entire public surface.

Fixed:

- `interval()` returned a NaN-sized interval.
- `dimensions.cover` was wrong for all non-square inputs.
- `rect.fromDimensions` leaked its precision argument into `x`.
- The two-argument form of `track.remap` returned a function.
- `interval.avoid` sometimes left the interval overlapping the forbidden zone.
- Polar angles broke beyond one negative revolution.
- Every multi-argument data-last `frame` setter constructed invalid values.
- Rect's curried clamp overloads produced NaN rects.
- Main-axis auto margins leaked `Infinity` positions.
- The solver laid out a lone overflowing frame in a wrapping container twice.
- `stack` dropped definite offsets beside auto offsets, truncated overflowing items below their `min`, and let auto offsets go negative.
- `sequence` let `place` shift auto-margin layouts, and resolved auto offsets negative on overflow.
- Fractional `growRatio`/`shrinkRatio` misreported consumed space, which misplaced `place`/`space`.
- Grow/shrink distribution no longer runs extra rounds on float dust.
- The wrap decision and all boundary predicates are tolerance-aware and scale-invariant.
- `equals` compares non-finite fields exactly (an infinity equals only itself), and infinite bounds no longer break the `contains`/`intersects` band.
- Frame offsets are physical in reversed flows. A `columnReverse` `offsetTop` stays at the physical top.
- A wrapping item's cross-axis `min` no longer inflates the previous line.
- Crossed clamp bounds resolve with the minimum winning (CSS semantics) everywhere.
