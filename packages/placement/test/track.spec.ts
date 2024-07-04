import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval'
import {
  type Track,
  alignItems,
  alignItemsTo,
  alignTo,
  distribute,
  distributeWithin,
  lerp,
  mapItemEnds,
  mapItemSizes,
  mapItemStarts,
  normalize,
  reflect,
  remap,
  scale,
  scaleFrom,
  setItemSizes,
  setSize,
  track,
  translate,
} from '../src/track'

interface TrackCase {
  input: Track
  operation: (track: Track) => Track
  output: Track
}

function describeTrackOperation(name: string, cases: ReadonlyArray<TrackCase>) {
  describe(name, () => {
    test.each(cases)(
      `${name}($input): $output`,
      ({ input, operation, output }) => {
        const result = operation(input)
        expect(result).toEqual(output)
      },
    )
  })
}

describeTrackOperation('translate', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: translate(10),
    output: track([interval(10, 100), interval(110, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: translate(-10),
    output: track([interval(-10, 100), interval(90, 100)]),
  },
])

describeTrackOperation('scale', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: scale(2),
    output: track([interval(0, 200), interval(200, 200)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: scale(0.5),
    output: track([interval(0, 50), interval(50, 50)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: scale(-1),
    output: track([interval(-100, 100), interval(-200, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: scale(2, 1),
    output: track([interval(-200, 200), interval(0, 200)]),
  },
])

describeTrackOperation('scaleFrom', [
  {
    input: track([interval(100, 100), interval(200, 100)]),
    operation: scaleFrom(2, 100),
    output: track([interval(100, 200), interval(300, 200)]),
  },
  {
    input: track([interval(100, 100), interval(200, 100)]),
    operation: scaleFrom(2, 0),
    output: track([interval(200, 200), interval(400, 200)]),
  },
  {
    input: track([interval(100, 100), interval(200, 100)]),
    operation: scaleFrom(2, 300),
    output: track([interval(-100, 200), interval(100, 200)]),
  },
  {
    input: track([interval(100, 100), interval(200, 100)]),
    operation: scaleFrom(2, 400),
    output: track([interval(-200, 200), interval(0, 200)]),
  },
  {
    input: track([interval(100, 100), interval(200, 100)]),
    operation: scaleFrom(-1, 0),
    output: track([interval(-200, 100), interval(-300, 100)]),
  },
])

describeTrackOperation('alignTo', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignTo(50, 0),
    output: track([interval(50, 100), interval(150, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignTo(50, 0.5),
    output: track([interval(-50, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignTo(50, 1),
    output: track([interval(-150, 100), interval(-50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignTo(interval(100, 100), 0.5),
    output: track([interval(50, 100), interval(150, 100)]),
  },
])

describeTrackOperation('alignItemsTo', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignItemsTo(50),
    output: track([interval(50, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignItemsTo(50, 0),
    output: track([interval(50, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignItemsTo(50, 0.5),
    output: track([interval(0, 100), interval(0, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignItemsTo(50, 1),
    output: track([interval(-50, 100), interval(-50, 100)]),
  },
])

describeTrackOperation('alignItems', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignItems(0),
    output: track([interval(0, 100), interval(0, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignItems(0.5),
    output: track([interval(50, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignItems(1),
    output: track([interval(100, 100), interval(100, 100)]),
  },
])

describeTrackOperation('setItemSizes', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: setItemSizes(200),
    output: track([interval(0, 200), interval(100, 200)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: setItemSizes(200, 0.5),
    output: track([interval(-50, 200), interval(50, 200)]),
  },
])

describeTrackOperation('setSize', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: setSize(100),
    output: track([interval(0, 50), interval(50, 50)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: setSize(100, 0.5),
    output: track([interval(50, 50), interval(100, 50)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: setSize(100, 1),
    output: track([interval(100, 50), interval(150, 50)]),
  },
])

describeTrackOperation('reflect', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: reflect,
    output: track([interval(100, 100), interval(0, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: reflect(0),
    output: track([interval(-100, 100), interval(-200, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: reflect(0.5),
    output: track([interval(100, 100), interval(0, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: reflect(1),
    output: track([interval(300, 100), interval(200, 100)]),
  },
])

describeTrackOperation('normalize', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: normalize,
    output: track([interval(0, 0.5), interval(0.5, 0.5)]),
  },
  {
    input: track([interval(100, 100), interval(200, 100)]),
    operation: normalize,
    output: track([interval(0, 0.5), interval(0.5, 0.5)]),
  },
  {
    input: track([interval(100, 100), interval(300, 100)]),
    operation: normalize(interval(0, 400)),
    output: track([interval(0.25, 0.25), interval(0.75, 0.25)]),
  },
  {
    input: track([interval(100, 100), interval(200, 100)]),
    operation: normalize(interval(0, 100)),
    output: track([interval(1, 1), interval(2, 1)]),
  },
])

describeTrackOperation('mix', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: lerp(track([interval(0, 100), interval(100, 100)]), 0),
    output: track([interval(0, 100), interval(100, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: lerp(track([interval(50, 100), interval(50, 100)]), 0.5),
    output: track([interval(25, 100), interval(75, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: lerp(track([interval(100, 100), interval(0, 100)]), 1),
    output: track([interval(100, 100), interval(0, 100)]),
  },
  {
    input: track([interval(0, 100)]),
    operation: lerp(track([interval(100, 100), interval(0, 100)]), 1),
    output: track([interval(100, 100)]),
  },
])

describeTrackOperation('remap', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: remap(interval(0, 200), interval(100, 100)),
    output: track([interval(100, 50), interval(150, 50)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: remap(interval(-100, 100)),
    output: track([interval(-100, 50), interval(-50, 50)]),
  },
])

describeTrackOperation('distribute', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: distribute,
    output: track([interval(0, 100), interval(100, 100)]),
  },
  {
    input: track([interval(0, 100), interval(0, 100)]),
    operation: distribute,
    output: track([interval(0, 100), interval(100, 100)]),
  },
  {
    input: track([interval(0, 100), interval(0, 100)]),
    operation: distribute(0.5),
    output: track([interval(-50, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(0, 100)]),
    operation: distribute(1),
    output: track([interval(-100, 100), interval(0, 100)]),
  },
  {
    input: track([interval(0, 100), interval(0, 100)]),
    operation: distribute(0, 100),
    output: track([interval(0, 100), interval(200, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: distribute(0, 100),
    output: track([interval(0, 100), interval(200, 100)]),
  },
  {
    input: track([interval(0, 100), interval(0, 100)]),
    operation: distribute(0.5, 100),
    output: track([interval(-100, 100), interval(100, 100)]),
  },
])

describeTrackOperation('distributeWithin', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: distributeWithin,
    output: track([interval(0, 100), interval(100, 100)]),
  },
  {
    input: track([interval(0, 100), interval(0, 50), interval(0, 100)]),
    operation: distributeWithin,
    output: track([interval(0, 100), interval(25, 50), interval(0, 100)]),
  },
  {
    input: track([interval(0, 100), interval(0, 50), interval(0, 100)]),
    operation: distributeWithin(interval(100, 100)),
    output: track([interval(100, 100), interval(125, 50), interval(100, 100)]),
  },
])

describeTrackOperation('mapItemStarts', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemStarts((ival, index) => ival.start + index),
    output: track([interval(0, 100), interval(101, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemStarts(() => 0),
    output: track([interval(0, 100), interval(0, 100)]),
  },
])

describeTrackOperation('mapItemEnds', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemEnds((ival, index) => ival.end - index),
    output: track([interval(0, 100), interval(99, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemEnds(() => 0),
    output: track([interval(-100, 100), interval(-100, 100)]),
  },
])

describeTrackOperation('mapItemSizes', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemSizes((ival, index) => ival.size + index),
    output: track([interval(0, 100), interval(100, 101)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemSizes((ival, index) => ival.size + index * 2),
    output: track([interval(0, 100), interval(100, 102)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemSizes(() => 0),
    output: track([interval(0, 0), interval(100, 0)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemSizes(0),
    output: track([interval(0, 0), interval(100, 0)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemSizes((ival) => ival.size - 50, 0.5),
    output: track([interval(25, 50), interval(125, 50)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: mapItemSizes(
      (ival) => ival.size + 50,
      (_, index) => index,
    ),
    output: track([interval(0, 150), interval(50, 150)]),
  },
])
