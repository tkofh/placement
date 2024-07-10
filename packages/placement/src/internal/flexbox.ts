import { type Flexbox, wrap } from '../flexbox'
import type { Frame } from '../frame'
import type { Rect } from '../rect'
import { type Track, sequence, stack } from '../track'
import { auto } from '../utils/arguments'
import { clamp } from '../utils/math'
import type { SequenceTrackItem } from './track/sequence'
import type { StackTrackItem } from './track/stack'

export function applyFlexbox(
  frames: ReadonlyArray<Frame>,
  flexbox: Flexbox,
  parent: Rect,
) {
  const mainSize = parent[flexbox.mainDimension]
  const _crossSize = parent[flexbox.crossDimension]

  // todo make this use cross size when there is only one line
  const stackItems = stack({
    size: Number.POSITIVE_INFINITY,
    place: flexbox.alignContent,
    stretch: flexbox.stretchContent,
  })
  const sequenceItems = sequence({
    spaceOuter: flexbox.justifyContentSpaceOuter,
    space: flexbox.justifyContentSpace,
    gap: flexbox.mainGap,
    place: flexbox.justifyContent,
    size: parent[flexbox.mainDimension],
  })

  const mainTracks: Array<Track> = []
  const crossTracks: Array<Track> = []

  let totalMainSize = 0
  let minCrossSize = 0

  let mainItems: Array<SequenceTrackItem> = []
  let crossItems: Array<StackTrackItem> = []
  const lineItems: Array<SequenceTrackItem> = []

  for (const [_index, frame] of frames.entries()) {
    const basis = frame[flexbox.mainDimension]
    const start = frame[flexbox.mainOffsetStart]
    const end = frame[flexbox.mainOffsetEnd]

    const outerHypotheticalSize = basis + auto(start, 0) + auto(end, 0)

    const mainItem = {
      basis,
      start,
      end,
      min: frame[flexbox.mainDimensionMin],
      max: frame[flexbox.mainDimensionMax],
      grow: frame.grow,
      shrink: frame.shrink,
    } satisfies SequenceTrackItem
    const crossItem = {
      basis,
      start,
      end,
      min: frame[flexbox.crossDimensionMin],
      max: frame[flexbox.crossDimensionMax],
      place: frame.align,
      stretch: frame.stretchCross,
    } satisfies StackTrackItem

    minCrossSize = Math.max(minCrossSize, crossItem.min)

    if (flexbox.wrap !== wrap.nowrap) {
      if (totalMainSize + outerHypotheticalSize > mainSize) {
        let mainTrack: Track
        let crossTrack: Track
        if (mainItems.length === 0) {
          mainTrack = sequenceItems([mainItem])
          crossTrack = stackItems([crossItem])
        } else {
          mainTrack = sequenceItems(mainItems)
          crossTrack = stackItems(crossItems)
          mainItems = []
          crossItems = []
        }

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
    }

    mainItems.push(mainItem)
    crossItems.push(crossItem)
  }

  if (mainItems.length > 0) {
    mainTracks.push(sequenceItems(mainItems))
    crossTracks.push(stackItems(crossItems))
  }

  const _linesTrack = sequence(lineItems, {
    spaceOuter: flexbox.alignContentSpaceOuter,
    space: flexbox.alignContentSpace,
    gap: flexbox.crossGap,
    place: flexbox.alignContent,
    size: parent[flexbox.crossDimension],
    growRatio: clamp(flexbox.stretchContent, 0, 1),
  })
}
