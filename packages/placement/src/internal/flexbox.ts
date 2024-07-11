import { type Flexbox, wrap } from '../flexbox'
import type { Frame } from '../frame'
import { type Rect, rect } from '../rect'
import { type Track, scaleFrom, sequence, stack } from '../track'
import { auto } from '../utils/arguments'
import { clamp } from '../utils/math'
import type { SequenceTrackItem } from './track/sequence'
import type { StackTrackItem } from './track/stack'

function computeItem(frame: Frame, flexbox: Flexbox) {
  const basisMain = frame[flexbox.mainDimension]
  const mainStart = frame[flexbox.mainOffsetStart]
  const mainEnd = frame[flexbox.mainOffsetEnd]

  const outerHypotheticalSize =
    basisMain + auto(mainStart, 0) + auto(mainEnd, 0)

  const mainItem = {
    basis: basisMain,
    start: mainStart,
    end: mainEnd,
    min: frame[flexbox.mainDimensionMin],
    max: frame[flexbox.mainDimensionMax],
    grow: frame.grow,
    shrink: frame.shrink,
  } satisfies SequenceTrackItem
  const crossItem = {
    basis: frame[flexbox.crossDimension],
    start: frame[flexbox.crossOffsetStart],
    end: frame[flexbox.crossOffsetEnd],
    min: frame[flexbox.crossDimensionMin],
    max: frame[flexbox.crossDimensionMax],
    place: frame.align,
    stretch: frame.stretchCross,
  } satisfies StackTrackItem

  return {
    mainItem,
    crossItem,
    outerHypotheticalSize,
  }
}

function computeMainTrack(
  items: ReadonlyArray<SequenceTrackItem>,
  flexbox: Flexbox,
  parent: Rect,
) {
  const size = parent[flexbox.mainDimension]

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
  items: ReadonlyArray<StackTrackItem>,
  flexbox: Flexbox,
  parent: Rect,
  isSolo: boolean,
) {
  return stack(items, {
    place: flexbox.alignContent,
    stretch: flexbox.stretchContent,
    size: isSolo ? parent[flexbox.crossDimension] : Number.POSITIVE_INFINITY,
  })
}

function computeTracks(
  frames: ReadonlyArray<Frame>,
  flexbox: Flexbox,
  parent: Rect,
) {
  const mainSize = parent[flexbox.mainDimension]

  const mainTracks: Array<Track> = []
  const crossTracks: Array<Track> = []

  let totalMainSize = 0
  let minCrossSize = 0

  let mainItems: Array<SequenceTrackItem> = []
  let crossItems: Array<StackTrackItem> = []
  const lineItems: Array<SequenceTrackItem> = []

  const lastIndex = frames.length - 1

  for (const [index, frame] of frames.entries()) {
    const { mainItem, crossItem, outerHypotheticalSize } = computeItem(
      frame,
      flexbox,
    )

    minCrossSize = Math.max(minCrossSize, crossItem.min)

    if (
      flexbox.wrap !== wrap.nowrap &&
      totalMainSize + outerHypotheticalSize > mainSize
    ) {
      const mainTrack = computeMainTrack(
        mainItems.length === 0 ? [mainItem] : mainItems,
        flexbox,
        parent,
      )
      const crossTrack = computeCrossTrack(
        crossItems.length === 0 ? [crossItem] : crossItems,
        flexbox,
        parent,
        index === lastIndex,
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
    mainTracks.push(computeMainTrack(mainItems, flexbox, parent))
    const crossTrack = computeCrossTrack(crossItems, flexbox, parent, false)
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

  const { mainTracks, crossTracks, lineItems } = computeTracks(
    frames,
    flexbox,
    parent,
  )

  const rects: Array<Rect> = []

  const xTracks = flexbox.isRow ? mainTracks : crossTracks
  const yTracks = flexbox.isRow ? crossTracks : mainTracks

  if (xTracks.length === 1) {
    const [xTrack] = xTracks
    const [yTrack] = yTracks

    const len = frames.length
    for (let i = 0; i < len; i++) {
      const xInterval = xTrack.intervals[i]
      const yInterval = yTrack.intervals[i]

      rects.push(
        rect(xInterval.start, yInterval.start, xInterval.size, yInterval.size),
      )
    }

    return rects
  }

  let lineTrack = sequence(lineItems, {
    spaceOuter: flexbox.alignContentSpaceOuter,
    space: flexbox.alignContentSpace,
    gap: flexbox.crossGap,
    place: flexbox.alignContent,
    size: parent[flexbox.crossDimension],
    growRatio: clamp(flexbox.stretchContent, 0, 1),
  })

  if (flexbox.wrap === wrap.wrapReverse) {
    lineTrack = lineTrack.pipe(
      scaleFrom(-1, parent[flexbox.crossDimension] * 0.5),
    )
  }

  const lineIntervals = lineTrack.intervals

  const parentX = parent.x
  const parentY = parent.y

  const tracksLen = xTracks.length
  for (let t = 0; t < tracksLen; t++) {
    const xTrack = xTracks[t]
    const yTrack = yTracks[t]

    const lineInterval = lineIntervals[t]

    const xOffset = flexbox.isRow ? 0 : lineInterval.start
    const yOffset = flexbox.isRow ? lineInterval.start : 0

    const len = xTrack.intervals.length
    for (let i = 0; i < len; i++) {
      const { start: xStart, size: xSize } = xTrack.intervals[i]
      const { start: yStart, size: ySize } = yTrack.intervals[i]

      rects.push(
        rect(
          parentX + xStart + xOffset,
          parentY + yStart + yOffset,
          xSize,
          ySize,
        ),
      )
    }
  }

  return rects
}
