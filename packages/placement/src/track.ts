import { lerp as lerpNumber } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import {
  type InternalSequenceTrackItem,
  type SequenceTrackItem,
  applyGrow,
  applyShrink,
  processItems,
} from './internal/track/sequence.ts'
import {
  type InternalStackTrackItem,
  type StackTrackItem,
  applyStretch,
  stackTrackItem,
} from './internal/track/stack.ts'
import {
  type Interval,
  type IntervalLike,
  alignTo as alignIntervalTo,
  equals as intervalEquals,
  interval,
  normalize as normalizeInterval,
  remap as remapInterval,
  setSize as setIntervalSize,
} from './interval.ts'
import { auto } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/track')
type TypeBrand = typeof TypeBrand

/**
 * A non-empty, ordered collection of `Interval`s along one axis — the shape
 * of a solved 1D layout, holding one interval per item in item order.
 *
 * Immutable: every operation returns a new `Track`. The bounds are exact
 * IEEE 754 arithmetic over the members (see PRECISION.md): `start` is the
 * smallest member start, `end` the largest member end, and `size` their
 * difference. Member intervals may have negative sizes, in which case the
 * bounds can invert (`end < start`).
 *
 * Construct with the `track` factory, or solve item specifications with
 * `stack` or `sequence`.
 */
class Track extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The member intervals, in the order given at construction. */
  readonly intervals: ReadonlyArray<Interval>

  /** The smallest `start` among the member intervals. */
  readonly start: number
  /** The largest `end` among the member intervals. */
  readonly end: number
  /**
   * The extent of the bounds: `end - start`. Negative when member intervals
   * with negative sizes invert the bounds.
   */
  readonly size: number

  constructor(intervals: ReadonlyArray<Interval>) {
    super()

    if (intervals.length === 0) {
      throw new RangeError('Track must contain at least one interval')
    }

    this.intervals = intervals

    let start = Number.POSITIVE_INFINITY
    let end = Number.NEGATIVE_INFINITY

    for (const ival of intervals) {
      start = Math.min(start, ival.start)
      end = Math.max(end, ival.end)
    }

    this.start = start
    this.end = end
    this.size = end - start
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Track [${this.intervals.map((ival) => `[${ival.start}, ${ival.end}]`).join(', ')}]`
  }

  /**
   * Serializes the track for `JSON.stringify`.
   *
   * @returns A plain object holding each member interval's JSON form
   * (`{ start, size }`).
   */
  toJSON() {
    return {
      intervals: this.intervals.map((ival) => ival.toJSON()),
    }
  }
}

export type { Track }

/**
 * Creates a `Track` from intervals.
 *
 * @param intervals - The member intervals, in order. Must be non-empty.
 * @returns A `Track` whose bounds enclose every interval.
 * @throws `RangeError` when `intervals` is empty.
 * @example
 * ```ts
 * const t = track([interval(0, 100), interval(150, 50)])
 * t.start // 0
 * t.end // 200
 * t.size // 200
 * ```
 */
export function track(intervals: ReadonlyArray<Interval>): Track {
  return new Track(intervals)
}

/**
 * Checks if a value is a `Track`.
 *
 * True only for values built by this module's constructors, which carry the
 * brand — a structural record of intervals is not a `Track`.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Track`, `false` otherwise.
 */
export const isTrack = (value: unknown): value is Track => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * An item to lay out with `stack`: a size specification plus per-item
 * placement. Every field is optional:
 *
 * - `basis` — the item's size before stretching, clamped to `[min, max]`.
 *   Defaults to `0`.
 * - `min` / `max` — bounds the final size never escapes. Negative values
 *   clamp to `0`. Default to `0` and `Infinity`.
 * - `start` / `end` — definite offsets reserved before and after the item.
 *   A non-finite value marks the offset auto: auto offsets absorb the
 *   item's free space (an auto `start` pushes the item to the track's end,
 *   auto offsets on both sides center it), and the item ignores `place` and
 *   never stretches. When the item overflows the track, auto offsets
 *   resolve to `0` instead of going negative. Default to `0`.
 * - `stretch` — the item's own stretch fraction, overriding the track-level
 *   `stretch`. Non-finite (the default) inherits the track's value.
 * - `place` — the item's own normalized position within its free space,
 *   overriding the track-level `place`. Non-finite (the default) inherits
 *   the track's value.
 */
export type StackItem = StackTrackItem

/**
 * An item to lay out with `sequence`: a flexbox-style main-axis
 * specification. Every field is optional:
 *
 * - `basis` — the item's size before growing or shrinking, clamped to
 *   `[min, max]`. Defaults to `0`.
 * - `min` / `max` — bounds the final size never escapes, even under grow or
 *   shrink pressure. Negative values clamp to `0`. Default to `0` and
 *   `Infinity`.
 * - `start` / `end` — definite offsets reserved before and after the item,
 *   like margins. A non-finite value marks the offset auto: under a
 *   definite track `size`, every auto offset in the sequence absorbs an
 *   equal share of the free space (an auto `start` pushes the item toward
 *   the end, auto offsets on both sides center it); without one they
 *   resolve to `0`. Default to `0`.
 * - `grow` — the item's share of positive free space, relative to the other
 *   items' `grow` factors. Defaults to `0`.
 * - `shrink` — the item's share of negative free space, scaled by its
 *   `basis` so larger items give up proportionally more (as in CSS
 *   flexbox). Defaults to `0`, unlike CSS's `1`.
 */
export type SequenceItem = SequenceTrackItem

interface BaseOptions {
  /**
   * Where leftover space places the content, as a normalized position: `0`
   * packs to the start, `0.5` centers, `1` packs to the end. Values outside
   * `[0, 1]` extrapolate. Defaults to `0`.
   *
   * `stack` positions each item independently; `sequence` positions the
   * whole run of items together.
   */
  place?: number
  /**
   * The size to lay out against. Omitted or `Number.POSITIVE_INFINITY`
   * means auto: `stack` uses its largest item's size, and `sequence` skips
   * free-space distribution entirely, keeping items at their natural sizes.
   */
  size?: number
}

/**
 * Options for `stack`. Every field is optional: an empty options object
 * lays each item out at its basis size, packed to the start.
 */
export interface StackOptions extends BaseOptions {
  /**
   * The fraction of each item's free space — the track size minus the
   * item's outer size — added to its size: `0` (the default) keeps items at
   * their basis, `1` stretches them to fill the track, negative values
   * shrink them. Results clamp to each item's `[min, max]`; items with auto
   * offsets never stretch.
   *
   * Items with a finite `stretch` of their own override this value.
   */
  stretch?: number
}

/**
 * Options for `sequence`. Every field is optional: an empty options object
 * lays items end to end at their basis sizes, starting at `0`.
 */
export interface SequenceOptions extends BaseOptions {
  /**
   * Space between adjacent items — never before the first or after the
   * last. Negative values overlap items. Gaps count toward the used size
   * that growing, shrinking, and free-space distribution work against.
   * Defaults to `0`.
   */
  gap?: number
  /**
   * The fraction of the free space left after growing and shrinking that
   * becomes spacing between the items; the rest is positioned by `place`.
   * Negative values (or negative free space) overlap items. Takes effect
   * only with a definite `size`, more than one item, and no auto offsets.
   * Defaults to `0`.
   */
  space?: number
  /**
   * How much of the spacing distributed by `space` reaches the track's
   * edges: `0` (the default) keeps it all between items (space-between),
   * `1` spreads it evenly around them (space-evenly). Inert unless `space`
   * distributes something.
   */
  spaceOuter?: number
  /**
   * The fraction of its computed growth each item actually receives: `1`
   * (the default) grows fully, `0` disables growing. Growth is distributed
   * and clamped against `[min, max]` first, then scaled; the growth a
   * fractional ratio withholds stays free for `space` and `place`.
   */
  growRatio?: number
  /**
   * The fraction of its computed shrinkage each item actually receives: `1`
   * (the default) shrinks fully, `0` disables shrinking. Shrinkage is
   * distributed and clamped against `[min, max]` first, then scaled; the
   * shrinkage a fractional ratio withholds still counts as used space for
   * `space` and `place`.
   */
  shrinkRatio?: number
}

/**
 * Solves a stack layout — flexbox's cross axis: items are laid over one
 * another against a shared origin at `0`, one interval per item in item
 * order.
 *
 * The track size is `options.size`, or the largest item's size when omitted
 * or non-finite. Each item takes its clamped `basis`, stretches by `stretch`
 * toward the track size, and lands at `place * free + start`, where `free`
 * is the track size minus the item's outer size (its size plus its
 * `start`/`end` offsets). An item with auto (non-finite) offsets ignores
 * `place`: the auto offsets absorb its free space instead, so an auto
 * `start` pushes it to the end and auto offsets on both sides center it.
 * When the item overflows the track, its auto offsets resolve to `0`
 * instead of going negative and its clamped size stands.
 *
 * The data-last form omits `items` and returns a function of them.
 *
 * @param items - The items to lay out. Must be non-empty.
 * @param options - The stack options; pass `{}` for the defaults.
 * @returns A `Track` with one interval per item, in item order.
 * @throws `RangeError` when `items` is empty.
 * @example
 * ```ts
 * stack([{ basis: 100 }, { basis: 200 }], { stretch: 1 })
 * // track([interval(0, 200), interval(0, 200)])
 *
 * const fill = stack({ stretch: 1 })
 * fill([{ basis: 100 }, { basis: 200 }])
 * // track([interval(0, 200), interval(0, 200)])
 * ```
 */
export const stack: {
  (items: ReadonlyArray<StackItem>, options: StackOptions): Track
  (options: StackOptions): (items: ReadonlyArray<StackItem>) => Track
} = dual(2, (items: ReadonlyArray<StackItem>, options: StackOptions): Track => {
  const trackItems: Array<InternalStackTrackItem> = []
  let maxSize = 0

  for (const item of items) {
    const trackItem = stackTrackItem(item)
    trackItems.push(trackItem)

    maxSize = Math.max(maxSize, trackItem.size)
  }

  const size = auto(options.size ?? Number.POSITIVE_INFINITY, maxSize)

  const stretch = options.stretch ?? 0
  const place = options.place ?? 0

  applyStretch(trackItems, size, stretch)

  return new Track(
    Array.from(trackItems, (item) => {
      const free = size - item.definiteOuterSize

      if (item.autoOffsetCount > 0) {
        // Auto offsets absorb the item's free space; when the item
        // overflows the track they resolve to zero instead of going
        // negative (as in CSS), and the min/max-clamped size stands.
        return interval(
          (item.startIsAuto ? Math.max(free, 0) / item.autoOffsetCount : 0) + item.definiteStart,
          item.size,
        )
      }

      return interval(auto(item.place, place) * free + item.definiteStart, item.size)
    }),
  )
})

function sequenceWithoutFreeSpace(
  items: ReadonlyArray<InternalSequenceTrackItem>,
  gap: number,
  autoOffset: number,
  start: number,
) {
  const intervals: Array<Interval> = []

  let cursor = start

  for (const item of items) {
    cursor += autoOffset * Number(item.startIsAuto) + item.definiteStart
    intervals.push(interval(cursor, item.size))
    cursor += item.size + gap + autoOffset * Number(item.endIsAuto) + item.definiteEnd
  }

  return new Track(intervals)
}

function sequenceWithFreeSpace(
  items: ReadonlyArray<InternalSequenceTrackItem>,
  size: number,
  used: number,
  gap: number,
  place: number,
  space: number,
  spaceOuter: number,
) {
  const intervals: Array<Interval> = []
  const free = size - used

  const distributed = free * space

  let cursor = 0
  let between = gap

  cursor += (free - distributed) * place

  if (Math.abs(distributed) > 0 && items.length > 1) {
    const spacing = distributed / (items.length + 1)
    cursor += spacing * spaceOuter
    between += spacing + (spacing * 2 * (1 - spaceOuter)) / (items.length - 1)
  }

  for (const item of items) {
    cursor += item.definiteStart
    intervals.push(interval(cursor, item.size))
    cursor += item.size + between + item.definiteEnd
  }

  return new Track(intervals)
}

/**
 * Solves a sequence layout — flexbox's main axis: items are placed one
 * after another, separated by `gap` and their own `start`/`end` offsets,
 * one interval per item in item order.
 *
 * With a definite `size`, the free space — `size` minus the items' outer
 * sizes and the gaps — resolves in priority order:
 *
 * - Auto (non-finite) `start`/`end` offsets, when any are present, absorb
 *   equal shares of the free space; growing, shrinking, and `space` are
 *   skipped.
 * - Otherwise items grow into positive free space or shrink to fit negative
 *   free space, weighted by their `grow`/`shrink` factors and clamped to
 *   their `[min, max]` bounds.
 * - Free space still left becomes spacing per `space` and `spaceOuter`, and
 *   the remainder positions the run per `place`.
 *
 * Without a `size` (omitted or `Infinity`), items keep their natural sizes,
 * auto offsets resolve to `0`, and `place` aligns the run relative to
 * coordinate `0` (`1` ends the run there).
 *
 * The data-last form omits `items` and returns a function of them.
 *
 * @param items - The items to lay out. Must be non-empty.
 * @param options - The sequence options; pass `{}` for the defaults.
 * @returns A `Track` with one interval per item, in item order.
 * @throws `RangeError` when `items` is empty.
 * @example
 * ```ts
 * sequence([{ basis: 100, grow: 1 }, { basis: 200 }], { size: 400 })
 * // track([interval(0, 200), interval(200, 200)])
 *
 * const fit = sequence({ size: 400 })
 * fit([{ basis: 100, grow: 1 }, { basis: 200 }])
 * // track([interval(0, 200), interval(200, 200)])
 * ```
 */
export const sequence: {
  (items: ReadonlyArray<SequenceItem>, options: SequenceOptions): Track
  (options: SequenceOptions): (items: ReadonlyArray<SequenceItem>) => Track
} = dual(2, (items: ReadonlyArray<SequenceItem>, options: SequenceOptions): Track => {
  const { trackItems, growable, shrinkable, totals } = processItems(items)

  const gap = options.gap ?? 0
  const place = options.place ?? 0

  const definiteOuterSize = totals.definiteOuterSize + (items.length - 1) * gap

  if (options.size == null || options.size === Number.POSITIVE_INFINITY) {
    return sequenceWithoutFreeSpace(trackItems, gap, 0, place * -definiteOuterSize)
  }

  const deltaSize = options.size - definiteOuterSize

  if (totals.autoOffsetCount > 0) {
    // Auto offsets absorb all the free space, so place has nothing left to
    // position (as in CSS, auto margins win over justification); when the
    // items overflow, the auto offsets resolve to zero instead of going
    // negative.
    return sequenceWithoutFreeSpace(
      trackItems,
      gap,
      Math.max(deltaSize, 0) / totals.autoOffsetCount,
      0,
    )
  }

  const consumed =
    definiteOuterSize +
    applyGrow(growable, deltaSize, totals.growthFactor, options.growRatio ?? 1) +
    applyShrink(shrinkable, deltaSize, totals.scaledShrinkFactor, options.shrinkRatio ?? 1)

  return sequenceWithFreeSpace(
    trackItems,
    options.size,
    consumed,
    gap,
    place,
    options.space ?? 0,
    options.spaceOuter ?? 0,
  )
})

/**
 * Computes the track's bounding interval.
 *
 * @param self - The track.
 * @returns `interval(self.start, self.size)`.
 * @example
 * ```ts
 * toInterval(track([interval(50, 100), interval(100, 100)])) // interval(50, 150)
 * ```
 */
export const toInterval = (self: Track): Interval => {
  return interval(self.start, self.size)
}

/**
 * Shifts every interval by `amount`, preserving sizes.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to shift.
 * @param amount - The signed distance added to every interval's start.
 * @returns The shifted `Track`.
 * @example
 * ```ts
 * const t = track([interval(0, 100), interval(100, 100)])
 * translate(t, 10) // track([interval(10, 100), interval(110, 100)])
 * t.pipe(translate(-10)) // track([interval(-10, 100), interval(90, 100)])
 * ```
 */
export const translate: {
  (self: Track, amount: number): Track
  (amount: number): (self: Track) => Track
} = dual(
  2,
  (self: Track, amount: number) =>
    new Track(self.intervals.map((ival) => interval(ival.start + amount, ival.size))),
)

/**
 * Scales the track about a point given as a normalized position within its
 * bounds: origin `0` holds `start` fixed, `1` holds `end`, `0.5` the
 * midpoint. Positions and sizes both scale; a negative `factor` mirrors
 * positions while sizes stay non-negative.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to scale.
 * @param factor - The scale factor.
 * @param origin - The fixed point, normalized to the track's bounds.
 * Defaults to `0`.
 * @returns The scaled `Track`.
 * @example
 * ```ts
 * const t = track([interval(0, 100), interval(100, 100)])
 * scale(t, 2) // track([interval(0, 200), interval(200, 200)])
 * t.pipe(scale(2, 1)) // track([interval(-200, 200), interval(0, 200)])
 * ```
 */
export const scale: {
  (self: Track, factor: number, origin?: number): Track
  (factor: number, origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, factor: number, origin = 0) =>
    scaleFrom(self, factor, lerpNumber(origin, self.start, self.end)),
)

/**
 * Scales the track about an absolute coordinate — the fixed-position
 * counterpart of `scale`, whose origin is normalized. A negative `factor`
 * mirrors positions while sizes stay non-negative.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to scale.
 * @param factor - The scale factor.
 * @param position - The coordinate held fixed.
 * @returns The scaled `Track`.
 * @example
 * ```ts
 * scaleFrom(track([interval(100, 100), interval(200, 100)]), 2, 100)
 * // track([interval(100, 200), interval(300, 200)])
 * ```
 */
export const scaleFrom: {
  (self: Track, factor: number, position: number): Track
  (factor: number, position: number): (self: Track) => Track
} = dual(
  3,
  (self: Track, factor: number, position: number) =>
    new Track(
      Array.from(self.intervals, (ival) => {
        const size = ival.size * factor
        return interval(
          position + (ival.start - position) * factor + Math.min(size, 0),
          Math.abs(size),
        )
      }),
    ),
)

// alignTo takes a fixed arity: its target may itself be a Track, so a
// trailing optional would make 2-argument calls ambiguous between the
// data-first and data-last forms.
/**
 * Moves the track rigidly — item layout preserved — so the point at
 * `origin` within its bounds lands on the corresponding point of `target`:
 * a number is the position itself, while an interval or track contributes
 * `target.start + target.size * origin`.
 *
 * Both `target` and `origin` are always required: a 2-argument call is the
 * data-last form, which omits `self` and returns a function of it.
 *
 * @param self - The track to move.
 * @param target - The position or interval-like to align with.
 * @param origin - The normalized anchor: `0` aligns starts, `0.5`
 * midpoints, `1` ends.
 * @returns The moved `Track`.
 * @example
 * ```ts
 * const t = track([interval(0, 100), interval(100, 100)])
 * alignTo(t, 50, 1) // track([interval(-150, 100), interval(-50, 100)])
 * t.pipe(alignTo(interval(100, 100), 0.5))
 * // track([interval(50, 100), interval(150, 100)])
 * ```
 */
export const alignTo: {
  (self: Track, target: number | IntervalLike | Track, origin: number): Track
  (target: number | IntervalLike | Track, origin: number): (self: Track) => Track
} = dual(3, (self: Track, target: number | IntervalLike | Track, origin: number) => {
  const position = typeof target === 'number' ? target : target.start + target.size * origin
  const delta = position - self.size * origin - self.start
  return new Track(self.intervals.map((ival) => interval(ival.start + delta, ival.size)))
})

/**
 * Scales the track so its bounds span `size`, holding the point at `origin`
 * fixed: `scale(self, size / self.size, origin)`, so item sizes and spacing
 * change proportionally. A zero-size track divides by zero and yields IEEE
 * `Infinity`/`NaN` coordinates (see PRECISION.md).
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to resize.
 * @param size - The new size of the bounds.
 * @param origin - The fixed point, normalized to the track's bounds.
 * Defaults to `0`.
 * @returns The resized `Track`.
 * @example
 * ```ts
 * const t = track([interval(0, 100), interval(100, 100)])
 * setSize(t, 100) // track([interval(0, 50), interval(50, 50)])
 * t.pipe(setSize(100, 0.5)) // track([interval(50, 50), interval(100, 50)])
 * ```
 */
export const setSize: {
  (self: Track, size: number, origin?: number): Track
  (size: number, origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, size: number, origin = 0) => scale(self, size / self.size, origin),
)

/**
 * Maps every interval through `fn`; the results become the new track's
 * intervals, in the same order.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to map.
 * @param fn - Receives each interval, its index, and the whole track;
 * returns the replacement interval.
 * @returns A `Track` of the mapped intervals.
 */
export const map: {
  (self: Track, fn: (interval: Interval, index: number, track: Track) => Interval): Track
  (fn: (interval: Interval, index: number, track: Track) => Interval): (self: Track) => Track
} = dual(
  2,
  (self: Track, fn: (interval: Interval, index: number, track: Track) => Interval): Track =>
    new Track(Array.from(self.intervals, (ival, index) => fn(ival, index, self))),
)

/**
 * Aligns every item to the same absolute coordinate: each interval's point
 * at `origin` (normalized within the item) lands on `position`. Sizes are
 * preserved, so the items end up overlapping.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track whose items to align.
 * @param position - The coordinate every item is aligned to.
 * @param origin - The anchor within each item: `0` its start, `0.5` its
 * center, `1` its end. Defaults to `0`.
 * @returns The aligned `Track`.
 * @example
 * ```ts
 * alignItemsTo(track([interval(0, 100), interval(100, 100)]), 50)
 * // track([interval(50, 100), interval(50, 100)])
 * ```
 */
export const alignItemsTo: {
  (self: Track, position: number, origin?: number): Track
  (position: number, origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, position: number, origin = 0) =>
    new Track(self.intervals.map((ival) => interval(position - ival.size * origin, ival.size))),
)

/**
 * Aligns every item to the same normalized position within the track's
 * bounds: `0` the start, `0.5` the center, `1` the end. Sizes are
 * preserved, so the items end up overlapping.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track whose items to align.
 * @param align - The target position, normalized to the track's bounds.
 * @param origin - The anchor within each item. Defaults to `align`, so
 * items sit flush inside the bounds at either extreme.
 * @returns The aligned `Track`.
 * @example
 * ```ts
 * alignItems(track([interval(0, 100), interval(100, 100)]), 0.5)
 * // track([interval(50, 100), interval(50, 100)])
 * ```
 */
export const alignItems: {
  (self: Track, align: number, origin?: number): Track
  (align: number, origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, align: number, origin?: number) =>
    map(self, alignIntervalTo(lerpNumber(align, self.start, self.end), origin ?? align)),
)

/**
 * Mirrors the track about `origin`, reversing the items' spatial order
 * while keeping their sizes. The default origin `0.5` reflects the track in
 * place, within its own bounds. Equivalent to `scale(self, -1, origin)`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to mirror.
 * @param origin - The fixed point, normalized to the track's bounds.
 * Defaults to `0.5`.
 * @returns The mirrored `Track`.
 * @example
 * ```ts
 * const t = track([interval(0, 100), interval(100, 100)])
 * reflect(t) // track([interval(100, 100), interval(0, 100)])
 * t.pipe(reflect(0)) // track([interval(-100, 100), interval(-200, 100)])
 * ```
 */
export const reflect: {
  (self: Track, origin?: number): Track
  (origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, origin = 0.5) => scale(self, -1, origin),
)

/**
 * Re-expresses every interval as a fraction of `target`: starts map to
 * their normalized position within it, sizes to their share of its size.
 * With the default target — the track's own bounds — the result spans
 * `[0, 1]`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to normalize.
 * @param target - The reference interval. Defaults to `toInterval(self)`.
 * @returns The normalized `Track`.
 * @example
 * ```ts
 * normalize(track([interval(100, 100), interval(200, 100)]))
 * // track([interval(0, 0.5), interval(0.5, 0.5)])
 * ```
 */
export const normalize: {
  (self: Track, target?: Interval): Track
  (target?: Interval): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, target: Interval = toInterval(self)) => map(self, normalizeInterval(target)),
)

// remap takes a fixed arity: a Track is itself IntervalLike, so a 2-argument
// data-first convenience could not be disambiguated from the data-last form.
// Callers pass toInterval(self) as the source explicitly.
/**
 * Maps every interval from the `source` coordinate space into the `target`
 * space: starts remap between the spaces, sizes rescale by the ratio of the
 * spaces' sizes.
 *
 * The source is always explicit — a 2-argument call is the data-last form,
 * which omits `self` and returns a function of it. To remap from the
 * track's own bounds, pass `toInterval(self)` as `source`.
 *
 * @param self - The track to remap.
 * @param source - The space the intervals currently occupy.
 * @param target - The space to map them into.
 * @returns The remapped `Track`.
 * @example
 * ```ts
 * remap(track([interval(0, 100), interval(100, 100)]), interval(0, 200), interval(100, 100))
 * // track([interval(100, 50), interval(150, 50)])
 * ```
 */
export const remap: {
  (self: Track, source: Interval, target: Interval): Track
  (source: Interval, target: Interval): (self: Track) => Track
} = dual(3, (self: Track, source: Interval, target: Interval) =>
  map(self, remapInterval(source, target)),
)

/**
 * Lays the items end to end in array order, preserving sizes, with `gap`
 * between adjacent items. The run starts at
 * `start + origin * (size - runSize)`, so `origin` positions the packed run
 * within the track's current bounds: `0` at the start, `1` at the end.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to distribute.
 * @param origin - The run's normalized position within the bounds.
 * Defaults to `0`.
 * @param gap - The space between adjacent items. Defaults to `0`.
 * @returns The distributed `Track`.
 * @example
 * ```ts
 * distribute(track([interval(0, 100), interval(0, 100)]), 0.5)
 * // track([interval(-50, 100), interval(50, 100)])
 * ```
 */
export const distribute: {
  (self: Track, origin?: number, gap?: number): Track
  (origin?: number, gap?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, origin = 0, gap = 0) => {
    let totalSize = -gap
    for (const ival of self.intervals) {
      totalSize += ival.size + gap
    }

    const intervals: Array<Interval> = []

    let cursor = self.start + origin * (self.size - totalSize)
    for (const ival of self.intervals) {
      intervals.push(interval(cursor, ival.size))
      cursor += ival.size + gap
    }

    return new Track(intervals)
  },
)

/**
 * Spreads the items across `target` in array order: the first item starts
 * at `target.start`, the last ends at `target.end`, and the space left over
 * splits into equal gaps between adjacent items. Sizes are preserved; the
 * gaps are negative when the items oversize the target. A single item is
 * placed at `target.start`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to distribute.
 * @param target - The interval to span. Defaults to `toInterval(self)`.
 * @returns The distributed `Track`.
 * @example
 * ```ts
 * distributeWithin(track([interval(0, 100), interval(0, 50), interval(0, 100)]))
 * // track([interval(0, 100), interval(25, 50), interval(0, 100)])
 * ```
 */
export const distributeWithin: {
  (self: Track, target?: Interval): Track
  (target?: Interval): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, target: Interval = toInterval(self)) => {
    let totalSize = 0
    for (const ival of self.intervals) {
      totalSize += ival.size
    }

    const between = (target.size - totalSize) / (self.intervals.length - 1)

    const intervals: Array<Interval> = []

    let cursor = target.start
    for (const ival of self.intervals) {
      intervals.push(interval(cursor, ival.size))
      cursor += ival.size + between
    }

    return new Track(intervals)
  },
)

/**
 * Interpolates pairwise between two tracks' intervals: each start and size
 * moves `amount` of the way from `self`'s to `other`'s. When the interval
 * counts differ, the result keeps the shorter count and drops the unpaired
 * intervals.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track at `amount = 0`.
 * @param other - The track at `amount = 1`.
 * @param amount - The interpolation parameter.
 * @returns The interpolated `Track`.
 * @example
 * ```ts
 * const a = track([interval(0, 100), interval(100, 100)])
 * a.pipe(lerp(track([interval(50, 100), interval(50, 100)]), 0.5))
 * // track([interval(25, 100), interval(75, 100)])
 * ```
 */
export const lerp: {
  (self: Track, other: Track, amount: number): Track
  (other: Track, amount: number): (self: Track) => Track
} = dual(
  3,
  (self: Track, other: Track, amount: number) =>
    new Track(
      Array.from(
        { length: Math.min(self.intervals.length, other.intervals.length) },
        (_, index) => {
          const a = self.intervals[index] as Interval
          const b = other.intervals[index] as Interval
          return interval(lerpNumber(amount, a.start, b.start), lerpNumber(amount, a.size, b.size))
        },
      ),
    ),
)

/**
 * Repositions each interval to start at the coordinate returned by `fn`,
 * preserving sizes.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to reposition.
 * @param fn - Receives each interval and its index; returns the interval's
 * new start.
 * @returns The repositioned `Track`.
 */
export const mapItemStarts: {
  (self: Track, fn: (interval: Interval, index: number) => number): Track
  (fn: (interval: Interval, index: number) => number): (self: Track) => Track
} = dual(2, (self: Track, fn: (interval: Interval, index: number) => number) =>
  map(self, (ival, index) => interval(fn(ival, index), ival.size)),
)

/**
 * Repositions each interval to end at the coordinate returned by `fn`,
 * preserving sizes.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to reposition.
 * @param fn - Receives each interval and its index; returns the interval's
 * new end.
 * @returns The repositioned `Track`.
 */
export const mapItemEnds: {
  (self: Track, fn: (interval: Interval, index: number) => number): Track
  (fn: (interval: Interval, index: number) => number): (self: Track) => Track
} = dual(2, (self: Track, fn: (interval: Interval, index: number) => number) =>
  map(self, (ival, index) => interval(fn(ival, index) - ival.size, ival.size)),
)

/**
 * Resizes every item in place: each interval takes the size given by
 * `size`, anchored so its point at `origin` (normalized within the item:
 * `0` start, `0.5` center, `1` end) keeps its coordinate. `size` and
 * `origin` each accept a number or a per-item function.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The track to resize.
 * @param size - The new item size, or a function of each interval, its
 * index, and the track.
 * @param origin - The per-item anchor, or a function computing one.
 * Defaults to `0`, holding starts fixed.
 * @returns The resized `Track`.
 * @example
 * ```ts
 * const t = track([interval(0, 100), interval(100, 100)])
 * mapItemSizes(t, 0) // track([interval(0, 0), interval(100, 0)])
 * t.pipe(mapItemSizes((ival) => ival.size - 50, 0.5))
 * // track([interval(25, 50), interval(125, 50)])
 * ```
 */
export const mapItemSizes: {
  (
    self: Track,
    size: number | ((interval: Interval, index: number, track: Track) => number),
    origin?: number | ((interval: Interval, index: number, track: Track) => number),
  ): Track
  (
    size: number | ((interval: Interval, index: number, track: Track) => number),
    origin?: number | ((interval: Interval, index: number, track: Track) => number),
  ): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (
    self: Track,
    size: number | ((interval: Interval, index: number, track: Track) => number),
    origin: number | ((interval: Interval, index: number, track: Track) => number) = 0,
  ) => {
    if (typeof size === 'number' && typeof origin === 'number') {
      return map(self, setIntervalSize(size, origin))
    }

    const sizeOf = typeof size === 'number' ? () => size : size
    const originOf = typeof origin === 'number' ? () => origin : origin

    return map(self, (ival, index, current) => {
      const nextSize = sizeOf(ival, index, current)
      return interval(
        ival.start + (ival.size - nextSize) * originOf(ival, index, current),
        nextSize,
      )
    })
  },
)

/**
 * Checks two tracks for equality: the same number of intervals, with each
 * pair equal within tolerance (`coincident` per field — see PRECISION.md),
 * so rounding noise at any magnitude does not break equality.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first track.
 * @param other - The second track.
 * @returns `true` if the tracks match interval for interval.
 * @example
 * ```ts
 * equals(track([interval(0.1 + 0.2, 1)]), track([interval(0.3, 1)])) // true
 * track([interval(0, 100)]).pipe(equals(track([interval(0, 101)]))) // false
 * ```
 */
export const equals: {
  (self: Track, other: Track): boolean
  (other: Track): (self: Track) => boolean
} = dual(
  2,
  (self: Track, other: Track) =>
    self.intervals.length === other.intervals.length &&
    self.intervals.every((ival, index) => intervalEquals(ival, other.intervals[index] as Interval)),
)
