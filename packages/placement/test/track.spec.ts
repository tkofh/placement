import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval.ts'
import {
  type Track,
  alignItems,
  alignItemsTo,
  alignTo,
  distribute,
  distributeWithin,
  equals,
  isTrack,
  lerp,
  map,
  mapItemEnds,
  mapItemSizes,
  mapItemStarts,
  normalize,
  reflect,
  remap,
  scale,
  scaleFrom,
  setSize,
  toInterval,
  track,
  translate,
} from '../src/track.ts'

interface TrackCase {
  input: Track
  operation: (track: Track) => Track
  output: Track
}

function describeTrackOperation(name: string, cases: ReadonlyArray<TrackCase>) {
  describe(name, () => {
    test.each(cases)(`${name}($input): $output`, ({ input, operation, output }) => {
      const result = operation(input)
      expect(result).toEqual(output)
    })
  })
}

describe('track', () => {
  test('computes start, end, and size from its intervals', () => {
    const result = track([interval(0, 100), interval(150, 50)])
    expect(result.start).toBe(0)
    expect(result.end).toBe(200)
    expect(result.size).toBe(200)
  })

  test('throws a RangeError on empty input', () => {
    expect(() => track([])).toThrowError(RangeError)
  })
})

describe('guards', () => {
  test('isTrack', () => {
    expect(isTrack(track([interval(0, 100)]))).toBe(true)
    expect(isTrack(interval(0, 100))).toBe(false)
    expect(isTrack(null)).toBe(false)
  })
})

describe('toInterval', () => {
  test('returns the bounding interval', () => {
    expect(toInterval(track([interval(50, 100), interval(100, 100)]))).toEqual(interval(50, 150))
  })
})

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

describe('alignTo targets', () => {
  test('a track target routes like any interval-like (fixed arity keeps 2-argument calls data-last)', () => {
    const target = track([interval(200, 50)])
    expect(alignTo(track([interval(0, 100)]), target, 0)).toEqual(track([interval(200, 100)]))
    expect(track([interval(0, 100)]).pipe(alignTo(target, 0))).toEqual(track([interval(200, 100)]))
  })

  test('data-first form with a number target', () => {
    const result = alignTo(track([interval(0, 100), interval(100, 100)]), 50, 0.5)
    expect(isTrack(result)).toBe(true)
    expect(result).toEqual(track([interval(-50, 100), interval(50, 100)]))
  })
})

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

describeTrackOperation('lerp', [
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

describe('remap', () => {
  test('maps each interval from the source space to the target space', () => {
    const self = track([interval(0, 100), interval(100, 100)])
    expect(remap(self, interval(0, 200), interval(100, 100))).toEqual(
      track([interval(100, 50), interval(150, 50)]),
    )
  })

  test('the source is always explicit (regression: the 2-argument data-first convenience is removed)', () => {
    // remap(source, target) with two intervals is always the data-last form.
    const operation = remap(interval(0, 200), interval(100, 100))
    expect(typeof operation).toBe('function')
    expect(operation(track([interval(0, 100), interval(100, 100)]))).toEqual(
      track([interval(100, 50), interval(150, 50)]),
    )
  })

  test('remapping from the bounding interval passes toInterval(self) explicitly', () => {
    const self = track([interval(0, 100), interval(100, 100)])
    expect(remap(self, toInterval(self), interval(-100, 100))).toEqual(
      track([interval(-100, 50), interval(-50, 50)]),
    )
  })
})

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

describe('map', () => {
  test('maps each interval with its index and the track', () => {
    const input = track([interval(0, 100), interval(100, 100)])
    const result = map(input, (ival, index, self) =>
      interval(ival.start + index * self.size, ival.size),
    )
    expect(result).toEqual(track([interval(0, 100), interval(300, 100)]))
  })

  test('data-last form', () => {
    const operation = map((ival) => interval(ival.start + 10, ival.size))
    expect(track([interval(0, 100)]).pipe(operation)).toEqual(track([interval(10, 100)]))
  })
})

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

const dataFirstInput = () => track([interval(0, 100), interval(100, 100)])

describe('data-first forms', () => {
  const input = dataFirstInput

  test('translate', () => {
    expect(translate(input(), 10)).toEqual(track([interval(10, 100), interval(110, 100)]))
  })

  test('scale', () => {
    expect(scale(input(), 2)).toEqual(track([interval(0, 200), interval(200, 200)]))
    expect(scale(input(), 2, 1)).toEqual(track([interval(-200, 200), interval(0, 200)]))
  })

  test('scaleFrom', () => {
    expect(scaleFrom(input(), 2, 100)).toEqual(track([interval(-100, 200), interval(100, 200)]))
  })

  test('alignItemsTo', () => {
    expect(alignItemsTo(input(), 50)).toEqual(track([interval(50, 100), interval(50, 100)]))
    expect(alignItemsTo(input(), 50, 0.5)).toEqual(track([interval(0, 100), interval(0, 100)]))
  })

  test('alignItems', () => {
    expect(alignItems(input(), 0.5)).toEqual(track([interval(50, 100), interval(50, 100)]))
    expect(alignItems(input(), 0, 1)).toEqual(track([interval(-100, 100), interval(-100, 100)]))
  })

  test('setSize', () => {
    expect(setSize(input(), 100)).toEqual(track([interval(0, 50), interval(50, 50)]))
    expect(setSize(input(), 100, 0.5)).toEqual(track([interval(50, 50), interval(100, 50)]))
  })

  test('reflect', () => {
    expect(reflect(input())).toEqual(track([interval(100, 100), interval(0, 100)]))
    expect(reflect(input(), 0)).toEqual(track([interval(-100, 100), interval(-200, 100)]))
  })

  test('normalize', () => {
    expect(normalize(input())).toEqual(track([interval(0, 0.5), interval(0.5, 0.5)]))
    expect(normalize(input(), interval(0, 400))).toEqual(
      track([interval(0, 0.25), interval(0.25, 0.25)]),
    )
  })

  test('distribute', () => {
    expect(distribute(input())).toEqual(input())
    expect(distribute(track([interval(0, 100), interval(0, 100)]), 0.5)).toEqual(
      track([interval(-50, 100), interval(50, 100)]),
    )
    expect(distribute(input(), 0, 100)).toEqual(track([interval(0, 100), interval(200, 100)]))
  })

  test('distributeWithin', () => {
    expect(distributeWithin(track([interval(0, 100), interval(0, 50), interval(0, 100)]))).toEqual(
      track([interval(0, 100), interval(25, 50), interval(0, 100)]),
    )
    expect(distributeWithin(input(), interval(100, 100))).toEqual(
      track([interval(100, 100), interval(100, 100)]),
    )
  })

  test('lerp', () => {
    expect(lerp(input(), track([interval(50, 100), interval(50, 100)]), 0.5)).toEqual(
      track([interval(25, 100), interval(75, 100)]),
    )
  })

  test('mapItemStarts', () => {
    expect(mapItemStarts(input(), () => 0)).toEqual(track([interval(0, 100), interval(0, 100)]))
  })

  test('mapItemEnds', () => {
    expect(mapItemEnds(input(), () => 0)).toEqual(track([interval(-100, 100), interval(-100, 100)]))
  })

  test('mapItemSizes', () => {
    expect(mapItemSizes(input(), 0)).toEqual(track([interval(0, 0), interval(100, 0)]))
    expect(mapItemSizes(input(), (ival) => ival.size - 50, 0.5)).toEqual(
      track([interval(25, 50), interval(125, 50)]),
    )
  })
})

describe('equals', () => {
  test('per-interval equality', () => {
    expect(equals(track([interval(0, 100)]), track([interval(0, 100)]))).toBe(true)
    expect(equals(track([interval(0, 100)]), track([interval(0, 101)]))).toBe(false)
    expect(equals(track([interval(0, 100)]), track([interval(1, 100)]))).toBe(false)
  })

  test('tracks of different lengths are never equal', () => {
    expect(equals(track([interval(0, 100)]), track([interval(0, 100), interval(0, 100)]))).toBe(
      false,
    )
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(equals(track([interval(0.1 + 0.2, 1)]), track([interval(0.3, 1)]))).toBe(true)
    expect(
      equals(track([interval((0.1 + 0.2) * 1e9, 1e9)]), track([interval(0.3 * 1e9, 1e9)])),
    ).toBe(true)
  })

  test('data-last form', () => {
    expect(track([interval(0, 100)]).pipe(equals(track([interval(0, 100)])))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits the intervals', () => {
    expect(JSON.parse(JSON.stringify(track([interval(0, 100), interval(100, 50)])))).toEqual({
      intervals: [
        { start: 0, size: 100 },
        { start: 100, size: 50 },
      ],
    })
  })
})
