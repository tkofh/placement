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

export const direction = {
  row: 0,
  rowReverse: 1,
  column: 2,
  columnReverse: 3,
} as const

export const wrap = {
  nowrap: 0,
  wrap: 1,
  wrapReverse: 2,
} as const

export type FlexDirection = (typeof direction)[keyof typeof direction]
export type FlexWrap = (typeof wrap)[keyof typeof wrap]

export interface FlexboxInput {
  readonly direction?: FlexDirection
  readonly wrap?: FlexWrap
  readonly justifyContent?: number
  readonly justifyContentSpace?: number
  readonly justifyContentSpaceOuter?: number
  readonly alignItems?: number
  readonly stretchItems?: number
  readonly alignContent?: number
  readonly alignContentSpace?: number
  readonly alignContentSpaceOuter?: number
  readonly stretchContent?: number
  readonly rowGap?: number
  readonly columnGap?: number
}

const TypeBrand: unique symbol = Symbol('placement/flexbox')
type TypeBrand = typeof TypeBrand

const directionNames = ['row', 'row-reverse', 'column', 'column-reverse'] as const
const wrapNames = ['nowrap', 'wrap', 'wrap-reverse'] as const

class Flexbox extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly direction: FlexDirection
  readonly wrap: FlexWrap
  readonly justifyContent: number
  readonly justifyContentSpace: number
  readonly justifyContentSpaceOuter: number
  readonly alignItems: number
  readonly stretchItems: number
  readonly alignContent: number
  readonly alignContentSpace: number
  readonly alignContentSpaceOuter: number
  readonly stretchContent: number
  readonly rowGap: number
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

  get isRow(): boolean {
    return this.direction <= 1
  }

  get isReverse(): boolean {
    return this.direction % 2 === 1
  }

  get mainGap(): number {
    return this.isRow ? this.columnGap : this.rowGap
  }

  get crossGap(): number {
    return this.isRow ? this.rowGap : this.columnGap
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Flexbox [${directionNames[this.direction]} ${wrapNames[this.wrap]}]`
  }

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

export const flexbox = (input: FlexboxInput): Flexbox => new Flexbox(input)

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
    // Per-item stretch inherits the container's stretchItems, mirroring the
    // way align inherits alignItems.
    stretch: frame.stretch !== Number.POSITIVE_INFINITY ? frame.stretch : flexbox.stretchItems,
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
  return stack(items, {
    place: flexbox.alignItems,
    stretch: flexbox.stretchContent,
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

    if (flexbox.wrap !== wrap.nowrap && totalMainSize + outerHypotheticalSize > mainSize) {
      const mainTrack = computeMainTrack(
        mainItems.length === 0 ? [mainItem] : mainItems,
        flexbox,
        mainSize,
      )
      const crossTrack = computeCrossTrack(
        crossItems.length === 0 ? [crossItem] : crossItems,
        flexbox,
        crossSize,
        false,
      )
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
