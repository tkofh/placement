import { clamp } from 'curvy/number'
import { Pipeable } from 'curvy/utils'
import type { Frame } from '../frame.ts'
import type { Interval } from '../interval.ts'
import { type Rect, rect } from '../rect.ts'
import {
  type SequenceItem,
  type StackItem,
  type Track,
  scaleFrom,
  sequence,
  stack,
} from '../track.ts'
import { auto } from '../utils/arguments.ts'

/**
 * The main-axis directions, encoded as numbers: `row` is `0`, `rowReverse`
 * is `1`, `column` is `2`, `columnReverse` is `3`.
 *
 * The encoding is meaningful: directions `<= 1` are horizontal, and the odd
 * directions run the main axis backward, laying the first item at the far
 * edge.
 */
export const direction = {
  row: 0,
  rowReverse: 1,
  column: 2,
  columnReverse: 3,
} as const

/**
 * The wrapping modes, encoded as numbers: `nowrap` is `0`, `wrap` is `1`,
 * `wrapReverse` is `2`.
 *
 * - `nowrap` keeps every item on one line, which overflows the parent when
 *   the items do not fit.
 * - `wrap` starts a new line whenever the next item would overflow the
 *   main size.
 * - `wrapReverse` wraps identically but stacks the lines in the opposite
 *   cross direction — upward in a row container, since y points down.
 */
export const wrap = {
  nowrap: 0,
  wrap: 1,
  wrapReverse: 2,
} as const

/**
 * A main-axis direction: one of the four numeric encodings in `direction`
 * (`0` through `3`).
 */
export type FlexDirection = (typeof direction)[keyof typeof direction]

/**
 * A wrapping mode: one of the three numeric encodings in `wrap` (`0`
 * through `2`).
 */
export type FlexWrap = (typeof wrap)[keyof typeof wrap]

/**
 * The configuration accepted by `flexbox`. Every property is optional: an
 * empty input is a non-wrapping row with no alignment, spacing, or gaps.
 */
export interface FlexboxInput {
  /**
   * The main-axis direction, one of the `direction` encodings. Defaults to
   * `direction.row`.
   */
  readonly direction?: FlexDirection
  /**
   * The wrapping mode, one of the `wrap` encodings. Defaults to
   * `wrap.nowrap`.
   */
  readonly wrap?: FlexWrap
  /**
   * Main-axis placement of each line's item run within leftover free
   * space: `0` packs it at the main start, `0.5` centers it, `1` packs it
   * at the main end. Values outside `[0, 1]` extrapolate. Defaults to `0`.
   */
  readonly justifyContent?: number
  /**
   * The fraction of main-axis free space distributed as spacing between
   * items instead of being placed by `justifyContent`: `0` none, `1` all
   * of it. Takes effect with at least two items on the line. Defaults
   * to `0`.
   */
  readonly justifyContentSpace?: number
  /**
   * The share of the spacing distributed by `justifyContentSpace` moved to
   * the two outer edges of the run: `0` keeps it all between items
   * (space-between), `1` spaces the items evenly (space-evenly). Defaults
   * to `0`.
   */
  readonly justifyContentSpaceOuter?: number
  /**
   * Cross-axis placement of each item within its line: `0` start, `0.5`
   * center, `1` end. A frame with a finite `align` overrides it; the frame
   * default of `Infinity` inherits it. Defaults to `0`.
   */
  readonly alignItems?: number
  /**
   * The cross-axis stretch for items: `0` leaves an item at its own cross
   * size, `1` stretches it to its line's, and fractions land
   * proportionally between. The line's cross size is the parent's while
   * the layout is a single line, and the line's own once it wraps.
   *
   * A frame with a finite `stretch` overrides it; a non-finite frame
   * `stretch` (the default is `Infinity`) inherits it. An auto (`Infinity`)
   * cross offset defeats stretching, and min/max constraints still clamp
   * the result. Defaults to `0`.
   */
  readonly stretchItems?: number
  /**
   * Cross-axis placement of the packed lines when wrapping produces more
   * than one: `0` start, `0.5` center, `1` end. A single-line layout
   * ignores it. Defaults to `0`.
   */
  readonly alignContent?: number
  /**
   * The fraction of cross-axis free space distributed as spacing between
   * lines, as `justifyContentSpace` distributes along the main axis.
   * Defaults to `0`.
   */
  readonly alignContentSpace?: number
  /**
   * The share of the spacing distributed by `alignContentSpace` moved to
   * the outer edges of the line run, as `justifyContentSpaceOuter` along
   * the main axis. Defaults to `0`.
   */
  readonly alignContentSpaceOuter?: number
  /**
   * How far lines grow to fill leftover cross space when wrapping produces
   * more than one: `0` keeps each line at the size of its largest item,
   * `1` fills the parent. Clamped to `[0, 1]` at use. Defaults to `0`.
   */
  readonly stretchContent?: number
  /**
   * The vertical gutter: spacing between adjacent items in a column
   * container, and between adjacent lines in a row container. Defaults
   * to `0`.
   */
  readonly rowGap?: number
  /**
   * The horizontal gutter: spacing between adjacent items in a row
   * container, and between adjacent lines in a column container. Defaults
   * to `0`.
   */
  readonly columnGap?: number
}

const TypeBrand: unique symbol = Symbol('placement/flexbox')
type TypeBrand = typeof TypeBrand

const directionNames = ['row', 'row-reverse', 'column', 'column-reverse'] as const
const wrapNames = ['nowrap', 'wrap', 'wrap-reverse'] as const

/**
 * An immutable flexbox container specification: the main-axis direction,
 * wrapping mode, alignment and spacing ratios, and gaps that `applyFlexbox`
 * consumes together with the `Frame` item specs.
 *
 * Alignment is continuous rather than keyword-based: the placement
 * properties are ratios where `0` is the start, `0.5` the center, and `1`
 * the end, so any in-between or out-of-range position is expressible.
 * Construction applies defaults and stores the values as given, without
 * validation or clamping.
 *
 * Exported type-only; construct with `flexbox`.
 */
class Flexbox extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The main-axis direction, one of the `direction` encodings. */
  readonly direction: FlexDirection
  /** The wrapping mode, one of the `wrap` encodings. */
  readonly wrap: FlexWrap
  /**
   * Main-axis placement of each line's item run within leftover free
   * space: `0` start, `0.5` center, `1` end.
   */
  readonly justifyContent: number
  /**
   * The fraction of main-axis free space distributed as spacing between
   * items instead of being placed by `justifyContent`.
   */
  readonly justifyContentSpace: number
  /**
   * The share of the spacing distributed by `justifyContentSpace` moved to
   * the outer edges of the run: `0` is space-between, `1` space-evenly.
   */
  readonly justifyContentSpaceOuter: number
  /**
   * Cross-axis placement of each item within its line: `0` start, `0.5`
   * center, `1` end. Inherited by frames whose `align` is `Infinity`.
   */
  readonly alignItems: number
  /**
   * The cross-axis stretch for items: `0` none, `1` fills the line.
   * Inherited by frames whose `stretch` is `Infinity`.
   */
  readonly stretchItems: number
  /**
   * Cross-axis placement of the packed lines in a multi-line layout: `0`
   * start, `0.5` center, `1` end.
   */
  readonly alignContent: number
  /**
   * The fraction of cross-axis free space distributed as spacing between
   * lines.
   */
  readonly alignContentSpace: number
  /**
   * The share of the spacing distributed by `alignContentSpace` moved to
   * the outer edges of the line run.
   */
  readonly alignContentSpaceOuter: number
  /**
   * How far lines grow to fill leftover cross space in a multi-line
   * layout: `0` none, `1` fills the parent. Clamped to `[0, 1]` at use.
   */
  readonly stretchContent: number
  /**
   * The vertical gutter: between items in a column container, between
   * lines in a row container.
   */
  readonly rowGap: number
  /**
   * The horizontal gutter: between items in a row container, between
   * lines in a column container.
   */
  readonly columnGap: number

  constructor(input: FlexboxInput) {
    super()

    this.direction = input.direction ?? direction.row
    this.wrap = input.wrap ?? wrap.nowrap
    this.justifyContent = input.justifyContent ?? 0
    this.justifyContentSpace = input.justifyContentSpace ?? 0
    this.justifyContentSpaceOuter = input.justifyContentSpaceOuter ?? 0
    this.alignItems = input.alignItems ?? 0
    this.stretchItems = input.stretchItems ?? 0
    this.alignContent = input.alignContent ?? 0
    this.alignContentSpace = input.alignContentSpace ?? 0
    this.alignContentSpaceOuter = input.alignContentSpaceOuter ?? 0
    this.stretchContent = input.stretchContent ?? 0
    this.rowGap = input.rowGap ?? 0
    this.columnGap = input.columnGap ?? 0
  }

  /**
   * Whether the main axis is horizontal: `true` for `row` and
   * `rowReverse` (the encodings `<= 1`).
   */
  get isRow(): boolean {
    return this.direction <= 1
  }

  /**
   * Whether the main axis runs backward: `true` for `rowReverse` and
   * `columnReverse` (the odd encodings).
   */
  get isReverse(): boolean {
    return this.direction % 2 === 1
  }

  /**
   * The gap between adjacent items on the main axis: `columnGap` in a row
   * container, `rowGap` in a column container.
   */
  get mainGap(): number {
    return this.isRow ? this.columnGap : this.rowGap
  }

  /**
   * The gap between adjacent lines on the cross axis: `rowGap` in a row
   * container, `columnGap` in a column container.
   */
  get crossGap(): number {
    return this.isRow ? this.rowGap : this.columnGap
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Flexbox [${directionNames[this.direction]} ${wrapNames[this.wrap]}]`
  }

  /** Returns the resolved configuration as a plain JSON-serializable object. */
  toJSON() {
    return {
      direction: this.direction,
      wrap: this.wrap,
      justifyContent: this.justifyContent,
      justifyContentSpace: this.justifyContentSpace,
      justifyContentSpaceOuter: this.justifyContentSpaceOuter,
      alignItems: this.alignItems,
      stretchItems: this.stretchItems,
      alignContent: this.alignContent,
      alignContentSpace: this.alignContentSpace,
      alignContentSpaceOuter: this.alignContentSpaceOuter,
      stretchContent: this.stretchContent,
      rowGap: this.rowGap,
      columnGap: this.columnGap,
    }
  }
}

export type { Flexbox }

/**
 * Creates a `Flexbox` container specification from a partial configuration.
 * Omitted properties take their defaults, so `flexbox({})` is a
 * non-wrapping row with no alignment, spacing, or gaps.
 *
 * @param input - The container configuration. See `FlexboxInput` for the per-property defaults.
 * @returns An immutable `Flexbox`.
 * @example
 * ```ts
 * const container = flexbox({ direction: direction.column, rowGap: 10 })
 * container.isRow // false
 * container.mainGap // 10
 * ```
 */
export const flexbox = (input: FlexboxInput): Flexbox => new Flexbox(input)

/**
 * Checks if a value is a `Flexbox`.
 *
 * True only for values built by `flexbox`, which carry the brand — a
 * structural look-alike does not pass.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Flexbox`, `false` otherwise.
 * @example
 * ```ts
 * isFlexbox(flexbox({})) // true
 * isFlexbox({ direction: 0 }) // false
 * ```
 */
export const isFlexbox = (value: unknown): value is Flexbox => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Frame and Rect property names for the main and cross axes, selected once
// per applyFlexbox call from the flexbox direction.
interface AxisView {
  readonly mainDimension: 'width' | 'height'
  readonly mainDimensionMin: 'minWidth' | 'minHeight'
  readonly mainDimensionMax: 'maxWidth' | 'maxHeight'
  readonly mainOffsetStart: 'offsetLeft' | 'offsetTop'
  readonly mainOffsetEnd: 'offsetRight' | 'offsetBottom'
  readonly crossDimension: 'width' | 'height'
  readonly crossDimensionMin: 'minWidth' | 'minHeight'
  readonly crossDimensionMax: 'maxWidth' | 'maxHeight'
  readonly crossOffsetStart: 'offsetTop' | 'offsetLeft'
  readonly crossOffsetEnd: 'offsetBottom' | 'offsetRight'
}

const rowAxes: AxisView = {
  mainDimension: 'width',
  mainDimensionMin: 'minWidth',
  mainDimensionMax: 'maxWidth',
  mainOffsetStart: 'offsetLeft',
  mainOffsetEnd: 'offsetRight',
  crossDimension: 'height',
  crossDimensionMin: 'minHeight',
  crossDimensionMax: 'maxHeight',
  crossOffsetStart: 'offsetTop',
  crossOffsetEnd: 'offsetBottom',
}

const columnAxes: AxisView = {
  mainDimension: 'height',
  mainDimensionMin: 'minHeight',
  mainDimensionMax: 'maxHeight',
  mainOffsetStart: 'offsetTop',
  mainOffsetEnd: 'offsetBottom',
  crossDimension: 'width',
  crossDimensionMin: 'minWidth',
  crossDimensionMax: 'maxWidth',
  crossOffsetStart: 'offsetLeft',
  crossOffsetEnd: 'offsetRight',
}

function computeItem(frame: Frame, flexbox: Flexbox, axes: AxisView) {
  const basisMain = frame[axes.mainDimension]
  const mainStart = frame[axes.mainOffsetStart]
  const mainEnd = frame[axes.mainOffsetEnd]

  const outerHypotheticalSize = basisMain + auto(mainStart, 0) + auto(mainEnd, 0)

  const mainItem = {
    basis: basisMain,
    start: mainStart,
    end: mainEnd,
    min: frame[axes.mainDimensionMin],
    max: frame[axes.mainDimensionMax],
    grow: frame.grow,
    shrink: frame.shrink,
  } satisfies SequenceItem

  const crossItem = {
    basis: frame[axes.crossDimension],
    start: frame[axes.crossOffsetStart],
    end: frame[axes.crossOffsetEnd],
    min: frame[axes.crossDimensionMin],
    max: frame[axes.crossDimensionMax],
    place: frame.align,
    // Any non-finite per-item stretch inherits the container's stretchItems,
    // exactly as a non-finite align inherits alignItems inside stack().
    stretch: auto(frame.stretch, flexbox.stretchItems, 0),
  } satisfies StackItem

  return { mainItem, crossItem, outerHypotheticalSize }
}

function computeMainTrack(items: ReadonlyArray<SequenceItem>, flexbox: Flexbox, size: number) {
  let result = sequence(items, {
    spaceOuter: flexbox.justifyContentSpaceOuter,
    space: flexbox.justifyContentSpace,
    gap: flexbox.mainGap,
    place: flexbox.justifyContent,
    size,
  })

  if (flexbox.isReverse) {
    result = result.pipe(scaleFrom(-1, size * 0.5))
  }

  return result
}

function computeCrossTrack(
  items: ReadonlyArray<StackItem>,
  flexbox: Flexbox,
  crossSize: number,
  isSolo: boolean,
) {
  // Every item arrives with a finite stretch (computeItem resolves the
  // inherit sentinel), so no track-level stretch fallback is passed.
  return stack(items, {
    place: flexbox.alignItems,
    size: isSolo ? crossSize : Number.POSITIVE_INFINITY,
  })
}

function computeTracks(
  frames: ReadonlyArray<Frame>,
  flexbox: Flexbox,
  parent: Rect,
  axes: AxisView,
) {
  const mainSize = parent[axes.mainDimension]
  const crossSize = parent[axes.crossDimension]

  const mainTracks: Array<Track> = []
  const crossTracks: Array<Track> = []

  let totalMainSize = 0
  let minCrossSize = 0

  let mainItems: Array<SequenceItem> = []
  let crossItems: Array<StackItem> = []
  const lineItems: Array<SequenceItem> = []

  for (const frame of frames) {
    const { mainItem, crossItem, outerHypotheticalSize } = computeItem(frame, flexbox, axes)

    minCrossSize = Math.max(minCrossSize, crossItem.min)

    // Flush only when the line already has items: a lone overflowing frame
    // keeps its own line (flushing it here AND pushing it below would emit
    // more rects than frames).
    if (
      flexbox.wrap !== wrap.nowrap &&
      mainItems.length > 0 &&
      totalMainSize + outerHypotheticalSize > mainSize
    ) {
      const mainTrack = computeMainTrack(mainItems, flexbox, mainSize)
      const crossTrack = computeCrossTrack(crossItems, flexbox, crossSize, false)
      mainItems = []
      crossItems = []

      mainTracks.push(mainTrack)
      crossTracks.push(crossTrack)

      lineItems.push({
        min: minCrossSize,
        basis: crossTrack.size,
        start: 0,
        end: 0,
        max: Number.POSITIVE_INFINITY,
        grow: 1,
        shrink: 0,
      })
      minCrossSize = 0
      totalMainSize = 0
    }
    totalMainSize += outerHypotheticalSize + flexbox.mainGap

    mainItems.push(mainItem)
    crossItems.push(crossItem)
  }

  if (mainItems.length > 0) {
    mainTracks.push(computeMainTrack(mainItems, flexbox, mainSize))
    const crossTrack = computeCrossTrack(crossItems, flexbox, crossSize, crossTracks.length === 0)
    crossTracks.push(crossTrack)
    lineItems.push({
      min: minCrossSize,
      basis: crossTrack.size,
      start: 0,
      end: 0,
      max: Number.POSITIVE_INFINITY,
      grow: 1,
      shrink: 0,
    })
  }

  return {
    mainTracks,
    crossTracks,
    lineItems,
  }
}

/**
 * Lays out `frames` as flex items inside `parent` and returns their rects,
 * in frame order, in `parent`'s coordinate space.
 *
 * The main axis follows `flexbox.direction` and wrapping follows
 * `flexbox.wrap`. Free space is distributed by the frames' `grow` and
 * `shrink` before the justify and align ratios place what remains. A frame
 * whose `align` or `stretch` is non-finite (both default to `Infinity`)
 * inherits the container's
 * `alignItems` or `stretchItems`, and a non-finite frame offset is an auto
 * margin that absorbs free space on its side. The space is y-down: cross
 * positions grow toward `parent.bottom`, and `wrapReverse` stacks lines
 * upward instead.
 *
 * Results are exact IEEE 754 arithmetic, never rounded, and are not
 * clipped to `parent`: a `nowrap` line that does not fit extends past the
 * parent's edge, as do lines wrapped beyond the cross size.
 *
 * With no frames there is nothing to solve: an empty input returns an
 * empty array immediately, without consulting `flexbox` or `parent`.
 *
 * @param frames - The flex-item specifications, one rect each in the result.
 * @param flexbox - The container specification.
 * @param parent - The rect to lay out within; its origin offsets every result.
 * @returns The laid-out rects, in `frames` order.
 * @example
 * ```ts
 * const items = [
 *   frame({ width: 100, aspectRatio: 1 }),
 *   frame({ width: 100, aspectRatio: 1 }),
 *   frame({ width: 100, aspectRatio: 1 }),
 * ]
 * applyFlexbox(items, flexbox({ wrap: wrap.wrap }), rect(200))
 * // [rect(0, 0, 100), rect(100, 0, 100), rect(0, 100, 100)]
 * ```
 */
export function applyFlexbox(
  frames: ReadonlyArray<Frame>,
  flexbox: Flexbox,
  parent: Rect,
): ReadonlyArray<Rect> {
  if (frames.length === 0) {
    return []
  }

  const axes = flexbox.isRow ? rowAxes : columnAxes

  const { mainTracks, crossTracks, lineItems } = computeTracks(frames, flexbox, parent, axes)

  const rects: Array<Rect> = []

  const xTracks = flexbox.isRow ? mainTracks : crossTracks
  const yTracks = flexbox.isRow ? crossTracks : mainTracks

  const parentX = parent.x
  const parentY = parent.y

  if (xTracks.length === 1) {
    const xTrack = xTracks[0] as Track
    const yTrack = yTracks[0] as Track

    const len = frames.length
    for (let i = 0; i < len; i++) {
      const xInterval = xTrack.intervals[i] as Interval
      const yInterval = yTrack.intervals[i] as Interval

      rects.push(
        rect(parentX + xInterval.start, parentY + yInterval.start, xInterval.size, yInterval.size),
      )
    }

    return rects
  }

  let lineTrack = sequence(lineItems, {
    spaceOuter: flexbox.alignContentSpaceOuter,
    space: flexbox.alignContentSpace,
    gap: flexbox.crossGap,
    place: flexbox.alignContent,
    size: parent[axes.crossDimension],
    growRatio: clamp(flexbox.stretchContent, 0, 1),
  })

  if (flexbox.wrap === wrap.wrapReverse) {
    lineTrack = lineTrack.pipe(scaleFrom(-1, parent[axes.crossDimension] * 0.5))
  }

  const lineIntervals = lineTrack.intervals

  const tracksLen = xTracks.length
  for (let t = 0; t < tracksLen; t++) {
    const xTrack = xTracks[t] as Track
    const yTrack = yTracks[t] as Track

    const lineInterval = lineIntervals[t] as Interval

    const xOffset = flexbox.isRow ? 0 : lineInterval.start
    const yOffset = flexbox.isRow ? lineInterval.start : 0

    const len = xTrack.intervals.length
    for (let i = 0; i < len; i++) {
      const { start: xStart, size: xSize } = xTrack.intervals[i] as Interval
      const { start: yStart, size: ySize } = yTrack.intervals[i] as Interval

      rects.push(rect(parentX + xStart + xOffset, parentY + yStart + yOffset, xSize, ySize))
    }
  }

  return rects
}
