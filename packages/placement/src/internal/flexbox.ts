import { EPSILON, RELATIVE_TOLERANCE, clamp } from 'curvy/number'
import { Pipeable } from 'curvy/utils'
import type { Frame } from '../frame.ts'
import type { Interval } from '../interval.ts'
import * as Rect from '../rect.ts'
import * as Sizing from '../sizing.ts'
import * as Track from '../track.ts'
import { auto } from '../utils/arguments.ts'
import { SizingOf } from './sizing.ts'

/**
 * The main-axis directions, encoded as numbers: `row` is `0`, `rowReverse`
 * is `1`, `column` is `2`, `columnReverse` is `3`.
 *
 * The encoding carries meaning. Directions `<= 1` are horizontal. The odd
 * directions run the main axis backward and put the first item at the far
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
 * - `wrap` starts a new line when the next item overflows the main size.
 *   The overflow test uses a tolerance (see PRECISION.md), so rounding
 *   residue never wraps a line.
 * - `wrapReverse` wraps the same way but stacks the lines in the opposite
 *   cross direction. In a row container, that direction is upward, because
 *   y points down.
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
 * The configuration that `make` accepts. Every property is optional. An
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
   * The fraction of main-axis free space that becomes spacing between
   * items instead of going to `justifyContent`: `0` none, `1` all of it.
   * It takes effect only with at least two items on the line. Defaults to
   * `0`.
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
   * center, `1` end. A frame with a finite `align` overrides it. The frame
   * default of `Infinity` inherits it. Defaults to `0`.
   */
  readonly alignItems?: number
  /**
   * The cross-axis stretch for items: `0` leaves an item at its own cross
   * size, `1` stretches it to the cross size of its line, and a fraction
   * gives a proportional size between the two. In a single-line layout,
   * the line's cross size is the parent's. After wrapping, each line has
   * its own cross size.
   *
   * A frame with a finite `stretch` overrides it. A non-finite frame
   * `stretch` (the default is `Infinity`) inherits it. An auto (`Infinity`)
   * cross offset stops stretching, and min/max constraints still clamp the
   * result. Defaults to `0`.
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
   * `1` fills the parent. `apply` clamps it to `[0, 1]`. Defaults to `0`.
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
 * wrapping mode, alignment and spacing ratios, and gaps that `apply`
 * consumes together with the `Frame` item specs.
 *
 * Alignment is continuous, not keyword-based. The placement properties are
 * ratios where `0` is the start, `0.5` the center, and `1` the end, so they
 * can express any position between or outside those points. Construction
 * applies defaults and stores the values as given, without validation or
 * clamping.
 *
 * The class is exported type-only. Construct it with `make`.
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
   * center, `1` end. A frame whose `align` is `Infinity` inherits it.
   */
  readonly alignItems: number
  /**
   * The cross-axis stretch for items: `0` none, `1` fills the line. A
   * frame whose `stretch` is `Infinity` inherits it.
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
   * layout: `0` none, `1` fills the parent. `apply` clamps it to `[0, 1]`.
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
 * Omitted properties take their defaults, so `Flexbox.make({})` is a
 * non-wrapping row with no alignment, spacing, or gaps.
 *
 * @param input - The container configuration. See `FlexboxInput` for the per-property defaults.
 * @returns An immutable `Flexbox`.
 * @example
 * ```ts
 * const container = Flexbox.make({ direction: Flexbox.direction.column, rowGap: 10 })
 * container.isRow // false
 * container.mainGap // 10
 * ```
 */
export const make = (input: FlexboxInput): Flexbox => new Flexbox(input)

/**
 * Checks if a value is a `Flexbox`.
 *
 * True only for values that `make` built, which carry the brand. A
 * structural look-alike does not pass.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Flexbox`, `false` otherwise.
 * @example
 * ```ts
 * Flexbox.isFlexbox(Flexbox.make({})) // true
 * Flexbox.isFlexbox({ direction: 0 }) // false
 * ```
 */
export const isFlexbox = (value: unknown): value is Flexbox => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Frame and Rect property names for the main and cross axes. `apply` selects
// them once per call from the flexbox direction.
interface AxisView {
  readonly mainDimension: 'width' | 'height'
  readonly mainDimensionMin: 'minWidth' | 'minHeight'
  readonly mainDimensionMax: 'maxWidth' | 'maxHeight'
  readonly mainMarginStart: 'marginLeft' | 'marginTop'
  readonly mainMarginEnd: 'marginRight' | 'marginBottom'
  readonly crossDimension: 'width' | 'height'
  readonly crossDimensionMin: 'minWidth' | 'minHeight'
  readonly crossDimensionMax: 'maxWidth' | 'maxHeight'
  readonly crossMarginStart: 'marginTop' | 'marginLeft'
  readonly crossMarginEnd: 'marginBottom' | 'marginRight'
}

const rowAxes: AxisView = {
  mainDimension: 'width',
  mainDimensionMin: 'minWidth',
  mainDimensionMax: 'maxWidth',
  mainMarginStart: 'marginLeft',
  mainMarginEnd: 'marginRight',
  crossDimension: 'height',
  crossDimensionMin: 'minHeight',
  crossDimensionMax: 'maxHeight',
  crossMarginStart: 'marginTop',
  crossMarginEnd: 'marginBottom',
}

const columnAxes: AxisView = {
  mainDimension: 'height',
  mainDimensionMin: 'minHeight',
  mainDimensionMax: 'maxHeight',
  mainMarginStart: 'marginTop',
  mainMarginEnd: 'marginBottom',
  crossDimension: 'width',
  crossDimensionMin: 'minWidth',
  crossDimensionMax: 'maxWidth',
  crossMarginStart: 'marginLeft',
  crossMarginEnd: 'marginRight',
}

// One item as the tracks read it, and how its size follows the other axis
// through its aspect ratio once the layout sizes that axis.
interface Item {
  readonly sizing: Sizing.Sizing
  readonly main: Track.SequenceItem
  readonly cross: Track.StackItem
  readonly outerHypotheticalSize: number
  // An unset cross size that no stretch fixes follows the flexed main size.
  readonly followsMain: boolean
  // An unset main size follows the cross size that a stretch fixes.
  readonly followsCross: boolean
}

function computeItem(frame: Frame, flexbox: Flexbox, axes: AxisView): Item {
  const basisMain = frame[axes.mainDimension]
  // Frame margins are physical (marginLeft always names the left edge). A
  // reversed flow lays the main track out logically and then reflects it,
  // margins included. So the sources swap here, and each margin lands on its
  // named physical side after the reflection.
  const mainStart = frame[flexbox.isReverse ? axes.mainMarginEnd : axes.mainMarginStart]
  const mainEnd = frame[flexbox.isReverse ? axes.mainMarginStart : axes.mainMarginEnd]

  const outerHypotheticalSize = basisMain + auto(mainStart, 0) + auto(mainEnd, 0)

  const main = {
    basis: basisMain,
    start: mainStart,
    end: mainEnd,
    min: frame[axes.mainDimensionMin],
    max: frame[axes.mainDimensionMax],
    grow: frame.grow,
    shrink: frame.shrink,
  } satisfies Track.SequenceItem

  const cross = {
    basis: frame[axes.crossDimension],
    start: frame[axes.crossMarginStart],
    end: frame[axes.crossMarginEnd],
    min: frame[axes.crossDimensionMin],
    max: frame[axes.crossDimensionMax],
    place: frame.align,
    // Any non-finite per-item stretch inherits the container's stretchItems,
    // exactly as a non-finite align inherits alignItems inside stack().
    stretch: auto(frame.stretch, flexbox.stretchItems, 0),
  } satisfies Track.StackItem

  // The stack stretches an item without auto cross margins (see
  // `applyStretch`).
  const sizing = frame[SizingOf]
  const stretched =
    cross.stretch !== 0 && Number.isFinite(cross.start) && Number.isFinite(cross.end)
  const hasRatio = sizing.aspectRatio !== undefined

  return {
    sizing,
    main,
    cross,
    outerHypotheticalSize,
    followsMain: hasRatio && !stretched && Number.isNaN(sizing[axes.crossDimension]),
    followsCross: hasRatio && stretched && Number.isNaN(sizing[axes.mainDimension]),
  }
}

// The size on `dimension` of an item whose other axis the layout fixed at
// `size`.
function follow(sizing: Sizing.Sizing, dimension: 'width' | 'height', size: number): number {
  const resolved =
    dimension === 'width'
      ? Sizing.resolve(sizing, { width: 0, height: size, definiteHeight: true })
      : Sizing.resolve(sizing, { width: size, height: 0, definiteWidth: true })
  return resolved[dimension]
}

function computeMainTrack(
  items: ReadonlyArray<Track.SequenceItem>,
  flexbox: Flexbox,
  size: number,
) {
  let result = Track.sequence(items, {
    spaceOuter: flexbox.justifyContentSpaceOuter,
    space: flexbox.justifyContentSpace,
    gap: flexbox.mainGap,
    place: flexbox.justifyContent,
    size,
  })

  if (flexbox.isReverse) {
    result = result.pipe(Track.scaleFrom(-1, size * 0.5))
  }

  return result
}

// A non-finite `crossSize` sizes the line by its largest item.
function computeCrossTrack(
  items: ReadonlyArray<Track.StackItem>,
  flexbox: Flexbox,
  crossSize: number,
) {
  // Every item arrives with a finite stretch (computeItem resolves the
  // inherit sentinel), so no track-level stretch fallback is passed.
  return Track.stack(items, {
    place: flexbox.alignItems,
    size: crossSize,
  })
}

// Solves one line: the main track, then the cross track. A cross size
// that follows the main size derives from the flexed main size before the
// cross track sizes the line. A main size that follows a stretched cross
// size derives from it after, and the main track solves again. The line
// then keeps its cross size, and the cross sizes that follow the main size
// derive again from the new main sizes.
function computeLine(
  items: ReadonlyArray<Item>,
  flexbox: Flexbox,
  axes: AxisView,
  mainSize: number,
  crossSize: number,
): { mainTrack: Track.Track; crossTrack: Track.Track } {
  const crossItems = (mainTrack: Track.Track): Array<Track.StackItem> =>
    items.map((item, k) =>
      item.followsMain
        ? {
            ...item.cross,
            basis: follow(
              item.sizing,
              axes.crossDimension,
              (mainTrack.intervals[k] as Interval).size,
            ),
          }
        : item.cross,
    )

  let mainTrack = computeMainTrack(
    items.map((item) => item.main),
    flexbox,
    mainSize,
  )
  const firstCrossItems = crossItems(mainTrack)
  let crossTrack = computeCrossTrack(firstCrossItems, flexbox, crossSize)

  if (items.some((item) => item.followsCross)) {
    const stretched = crossTrack
    // The size the stack stretched into: the container's for a lone line,
    // or else its largest item's (see `stack`).
    let lineSize = crossSize
    if (!Number.isFinite(lineSize)) {
      lineSize = 0
      for (const { basis = 0, min = 0, max = Number.POSITIVE_INFINITY } of firstCrossItems) {
        lineSize = Math.max(lineSize, clamp(Math.max(basis, 0), Math.max(min, 0), Math.max(max, 0)))
      }
    }
    mainTrack = computeMainTrack(
      items.map((item, k) =>
        item.followsCross
          ? {
              ...item.main,
              basis: follow(
                item.sizing,
                axes.mainDimension,
                (stretched.intervals[k] as Interval).size,
              ),
            }
          : item.main,
      ),
      flexbox,
      mainSize,
    )
    crossTrack = computeCrossTrack(crossItems(mainTrack), flexbox, lineSize)
  }

  return { mainTrack, crossTrack }
}

function computeTracks(
  frames: ReadonlyArray<Frame>,
  flexbox: Flexbox,
  parent: Rect.Rect,
  axes: AxisView,
) {
  const mainSize = parent[axes.mainDimension]
  const crossSize = parent[axes.crossDimension]

  // Break the items into lines by their hypothetical main sizes.
  const lines: Array<Array<Item>> = []
  let line: Array<Item> = []
  let totalMainSize = 0

  for (const frame of frames) {
    const item = computeItem(frame, flexbox, axes)

    const requiredMainSize = totalMainSize + item.outerHypotheticalSize

    // Break only when the line already has items. A lone overflowing frame
    // keeps its own line. The overflow test uses a tolerance (see
    // PRECISION.md). Rounding residue past the main size must not wrap a
    // line that the same layout at another scale keeps whole.
    if (
      flexbox.wrap !== wrap.nowrap &&
      line.length > 0 &&
      requiredMainSize - mainSize >
        EPSILON + RELATIVE_TOLERANCE * Math.max(Math.abs(requiredMainSize), Math.abs(mainSize))
    ) {
      lines.push(line)
      line = []
      totalMainSize = 0
    }
    totalMainSize += item.outerHypotheticalSize + flexbox.mainGap
    line.push(item)
  }
  if (line.length > 0) {
    lines.push(line)
  }

  const mainTracks: Array<Track.Track> = []
  const crossTracks: Array<Track.Track> = []
  const lineItems: Array<Track.SequenceItem> = []

  // A lone line takes the container's cross size. Each of several lines
  // takes the size of its largest item.
  const lineCrossSize = lines.length === 1 ? crossSize : Number.POSITIVE_INFINITY
  for (const items of lines) {
    const { mainTrack, crossTrack } = computeLine(items, flexbox, axes, mainSize, lineCrossSize)
    mainTracks.push(mainTrack)
    crossTracks.push(crossTrack)

    let minCrossSize = 0
    for (const item of items) {
      minCrossSize = Math.max(minCrossSize, item.cross.min ?? 0)
    }
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
 * `flexbox.wrap`. The frames' `grow` and `shrink` distribute free space
 * first. Then the justify and align ratios place the rest. A frame whose
 * `align` or `stretch` is non-finite (both default to `Infinity`) inherits
 * the container's `alignItems` or `stretchItems`.
 *
 * An item with an `aspectRatio` keeps it as the layout sizes it, where its
 * own size leaves an axis unset:
 *
 * - An unset cross size follows the main size that `grow` and `shrink`
 *   give the item, unless a stretch sizes the cross axis.
 * - An unset main size follows a stretched cross size, and the main axis
 *   solves again with it. A lone line stretches its items into the
 *   container's cross size. Each of several lines stretches them into the
 *   size of its largest item, keeps that size, and keeps its items even if
 *   the new main sizes overflow it.
 *
 * Frame margins are physical in every direction. `marginLeft` pads the
 * item's left edge even in `rowReverse`. A non-finite margin is an auto
 * margin that absorbs free space on its named physical side. The y axis
 * points down, so cross positions grow toward `parent.bottom`, and
 * `wrapReverse` stacks lines upward instead.
 *
 * The results come from exact IEEE 754 arithmetic. `apply` never rounds
 * them and does not clip them to `parent`. A `nowrap` line that does not
 * fit extends past the parent's edge, and so do lines wrapped beyond the
 * cross size.
 *
 * An empty `frames` input returns an empty array at once and does not read
 * `flexbox` or `parent`.
 *
 * @param frames - The flex-item specifications, one rect each in the result.
 * @param flexbox - The container specification.
 * @param parent - The rect to lay out within. Its origin offsets every result.
 * @returns The laid-out rects, in `frames` order.
 * @example
 * ```ts
 * const items = [
 *   Frame.make({ width: 100, aspectRatio: 1 }),
 *   Frame.make({ width: 100, aspectRatio: 1 }),
 *   Frame.make({ width: 100, aspectRatio: 1 }),
 * ]
 * Flexbox.apply(items, Flexbox.make({ wrap: Flexbox.wrap.wrap }), Rect.make(200))
 * // [Rect.make(0, 0, 100), Rect.make(100, 0, 100), Rect.make(0, 100, 100)]
 * ```
 */
export function apply(
  frames: ReadonlyArray<Frame>,
  flexbox: Flexbox,
  parent: Rect.Rect,
): ReadonlyArray<Rect.Rect> {
  if (frames.length === 0) {
    return []
  }

  const axes = flexbox.isRow ? rowAxes : columnAxes

  const { mainTracks, crossTracks, lineItems } = computeTracks(frames, flexbox, parent, axes)

  const rects: Array<Rect.Rect> = []

  const xTracks = flexbox.isRow ? mainTracks : crossTracks
  const yTracks = flexbox.isRow ? crossTracks : mainTracks

  const parentX = parent.x
  const parentY = parent.y

  if (xTracks.length === 1) {
    const xTrack = xTracks[0] as Track.Track
    const yTrack = yTracks[0] as Track.Track

    const len = frames.length
    for (let i = 0; i < len; i++) {
      const xInterval = xTrack.intervals[i] as Interval
      const yInterval = yTrack.intervals[i] as Interval

      rects.push(
        Rect.make(
          parentX + xInterval.start,
          parentY + yInterval.start,
          xInterval.size,
          yInterval.size,
        ),
      )
    }

    return rects
  }

  let lineTrack = Track.sequence(lineItems, {
    spaceOuter: flexbox.alignContentSpaceOuter,
    space: flexbox.alignContentSpace,
    gap: flexbox.crossGap,
    place: flexbox.alignContent,
    size: parent[axes.crossDimension],
    growRatio: clamp(flexbox.stretchContent, 0, 1),
  })

  if (flexbox.wrap === wrap.wrapReverse) {
    lineTrack = lineTrack.pipe(Track.scaleFrom(-1, parent[axes.crossDimension] * 0.5))
  }

  const lineIntervals = lineTrack.intervals

  const tracksLen = xTracks.length
  for (let t = 0; t < tracksLen; t++) {
    const xTrack = xTracks[t] as Track.Track
    const yTrack = yTracks[t] as Track.Track

    const lineInterval = lineIntervals[t] as Interval

    const xOffset = flexbox.isRow ? 0 : lineInterval.start
    const yOffset = flexbox.isRow ? lineInterval.start : 0

    const len = xTrack.intervals.length
    for (let i = 0; i < len; i++) {
      const { start: xStart, size: xSize } = xTrack.intervals[i] as Interval
      const { start: yStart, size: ySize } = yTrack.intervals[i] as Interval

      rects.push(Rect.make(parentX + xStart + xOffset, parentY + yStart + yOffset, xSize, ySize))
    }
  }

  return rects
}
