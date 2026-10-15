import { describe, expect, test } from 'vitest'
import * as Interval from '../src/interval.ts'
import * as Track from '../src/track.ts'

interface TrackCase {
  input: Track.Track
  operation: (track: Track.Track) => Track.Track
  output: Track.Track
}

function describeTrackOperation(name: string, cases: ReadonlyArray<TrackCase>) {
  describe(name, () => {
    test.each(cases)(`${name}($input): $output`, ({ input, operation, output }) => {
      const result = operation(input)
      expect(result).toEqual(output)
    })
  })
}

describe('make', () => {
  test('computes start, end, and size from its intervals', () => {
    const result = Track.make([Interval.make(0, 100), Interval.make(150, 50)])
    expect(result.start).toBe(0)
    expect(result.end).toBe(200)
    expect(result.size).toBe(200)
  })

  test('throws a RangeError on empty input', () => {
    expect(() => Track.make([])).toThrowError(RangeError)
  })
})

describe('guards', () => {
  test('isTrack', () => {
    expect(Track.isTrack(Track.make([Interval.make(0, 100)]))).toBe(true)
    expect(Track.isTrack(Interval.make(0, 100))).toBe(false)
    expect(Track.isTrack(null)).toBe(false)
  })
})

describe('toInterval', () => {
  test('returns the bounding interval', () => {
    expect(Track.toInterval(Track.make([Interval.make(50, 100), Interval.make(100, 100)]))).toEqual(
      Interval.make(50, 150),
    )
  })
})

describeTrackOperation('translate', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.translate(10),
    output: Track.make([Interval.make(10, 100), Interval.make(110, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.translate(-10),
    output: Track.make([Interval.make(-10, 100), Interval.make(90, 100)]),
  },
])

describeTrackOperation('scale', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.scale(2),
    output: Track.make([Interval.make(0, 200), Interval.make(200, 200)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.scale(0.5),
    output: Track.make([Interval.make(0, 50), Interval.make(50, 50)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.scale(-1),
    output: Track.make([Interval.make(-100, 100), Interval.make(-200, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.scale(2, 1),
    output: Track.make([Interval.make(-200, 200), Interval.make(0, 200)]),
  },
])

describeTrackOperation('scaleFrom', [
  {
    input: Track.make([Interval.make(100, 100), Interval.make(200, 100)]),
    operation: Track.scaleFrom(2, 100),
    output: Track.make([Interval.make(100, 200), Interval.make(300, 200)]),
  },
  {
    input: Track.make([Interval.make(100, 100), Interval.make(200, 100)]),
    operation: Track.scaleFrom(2, 0),
    output: Track.make([Interval.make(200, 200), Interval.make(400, 200)]),
  },
  {
    input: Track.make([Interval.make(100, 100), Interval.make(200, 100)]),
    operation: Track.scaleFrom(2, 300),
    output: Track.make([Interval.make(-100, 200), Interval.make(100, 200)]),
  },
  {
    input: Track.make([Interval.make(100, 100), Interval.make(200, 100)]),
    operation: Track.scaleFrom(2, 400),
    output: Track.make([Interval.make(-200, 200), Interval.make(0, 200)]),
  },
  {
    input: Track.make([Interval.make(100, 100), Interval.make(200, 100)]),
    operation: Track.scaleFrom(-1, 0),
    output: Track.make([Interval.make(-200, 100), Interval.make(-300, 100)]),
  },
])

describeTrackOperation('alignTo', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignTo(50, 0),
    output: Track.make([Interval.make(50, 100), Interval.make(150, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignTo(50, 0.5),
    output: Track.make([Interval.make(-50, 100), Interval.make(50, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignTo(50, 1),
    output: Track.make([Interval.make(-150, 100), Interval.make(-50, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignTo(Interval.make(100, 100), 0.5),
    output: Track.make([Interval.make(50, 100), Interval.make(150, 100)]),
  },
])

describe('alignTo targets', () => {
  test('a track target routes like any interval-like (fixed arity keeps 2-argument calls data-last)', () => {
    const target = Track.make([Interval.make(200, 50)])
    expect(Track.alignTo(Track.make([Interval.make(0, 100)]), target, 0)).toEqual(
      Track.make([Interval.make(200, 100)]),
    )
    expect(Track.make([Interval.make(0, 100)]).pipe(Track.alignTo(target, 0))).toEqual(
      Track.make([Interval.make(200, 100)]),
    )
  })

  test('data-first form with a number target', () => {
    const result = Track.alignTo(
      Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
      50,
      0.5,
    )
    expect(Track.isTrack(result)).toBe(true)
    expect(result).toEqual(Track.make([Interval.make(-50, 100), Interval.make(50, 100)]))
  })
})

describeTrackOperation('alignItemsTo', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignItemsTo(50),
    output: Track.make([Interval.make(50, 100), Interval.make(50, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignItemsTo(50, 0),
    output: Track.make([Interval.make(50, 100), Interval.make(50, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignItemsTo(50, 0.5),
    output: Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignItemsTo(50, 1),
    output: Track.make([Interval.make(-50, 100), Interval.make(-50, 100)]),
  },
])

describeTrackOperation('alignItems', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignItems(0),
    output: Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignItems(0.5),
    output: Track.make([Interval.make(50, 100), Interval.make(50, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.alignItems(1),
    output: Track.make([Interval.make(100, 100), Interval.make(100, 100)]),
  },
])

describeTrackOperation('setSize', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.setSize(100),
    output: Track.make([Interval.make(0, 50), Interval.make(50, 50)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.setSize(100, 0.5),
    output: Track.make([Interval.make(50, 50), Interval.make(100, 50)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.setSize(100, 1),
    output: Track.make([Interval.make(100, 50), Interval.make(150, 50)]),
  },
])

describeTrackOperation('reflect', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.reflect,
    output: Track.make([Interval.make(100, 100), Interval.make(0, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.reflect(0),
    output: Track.make([Interval.make(-100, 100), Interval.make(-200, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.reflect(0.5),
    output: Track.make([Interval.make(100, 100), Interval.make(0, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.reflect(1),
    output: Track.make([Interval.make(300, 100), Interval.make(200, 100)]),
  },
])

describeTrackOperation('normalize', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.normalize,
    output: Track.make([Interval.make(0, 0.5), Interval.make(0.5, 0.5)]),
  },
  {
    input: Track.make([Interval.make(100, 100), Interval.make(200, 100)]),
    operation: Track.normalize,
    output: Track.make([Interval.make(0, 0.5), Interval.make(0.5, 0.5)]),
  },
  {
    input: Track.make([Interval.make(100, 100), Interval.make(300, 100)]),
    operation: Track.normalize(Interval.make(0, 400)),
    output: Track.make([Interval.make(0.25, 0.25), Interval.make(0.75, 0.25)]),
  },
  {
    input: Track.make([Interval.make(100, 100), Interval.make(200, 100)]),
    operation: Track.normalize(Interval.make(0, 100)),
    output: Track.make([Interval.make(1, 1), Interval.make(2, 1)]),
  },
])

describeTrackOperation('lerp', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.lerp(Track.make([Interval.make(0, 100), Interval.make(100, 100)]), 0),
    output: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.lerp(Track.make([Interval.make(50, 100), Interval.make(50, 100)]), 0.5),
    output: Track.make([Interval.make(25, 100), Interval.make(75, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.lerp(Track.make([Interval.make(100, 100), Interval.make(0, 100)]), 1),
    output: Track.make([Interval.make(100, 100), Interval.make(0, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100)]),
    operation: Track.lerp(Track.make([Interval.make(100, 100), Interval.make(0, 100)]), 1),
    output: Track.make([Interval.make(100, 100)]),
  },
])

describe('remap', () => {
  test('maps each interval from the source space to the target space', () => {
    const self = Track.make([Interval.make(0, 100), Interval.make(100, 100)])
    expect(Track.remap(self, Interval.make(0, 200), Interval.make(100, 100))).toEqual(
      Track.make([Interval.make(100, 50), Interval.make(150, 50)]),
    )
  })

  test('the source is always explicit (regression: the 2-argument data-first convenience is removed)', () => {
    // Track.remap(source, target) with two intervals is always the data-last form.
    const operation = Track.remap(Interval.make(0, 200), Interval.make(100, 100))
    expect(typeof operation).toBe('function')
    expect(operation(Track.make([Interval.make(0, 100), Interval.make(100, 100)]))).toEqual(
      Track.make([Interval.make(100, 50), Interval.make(150, 50)]),
    )
  })

  test('remapping from the bounding interval passes Track.toInterval(self) explicitly', () => {
    const self = Track.make([Interval.make(0, 100), Interval.make(100, 100)])
    expect(Track.remap(self, Track.toInterval(self), Interval.make(-100, 100))).toEqual(
      Track.make([Interval.make(-100, 50), Interval.make(-50, 50)]),
    )
  })
})

describeTrackOperation('distribute', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.distribute,
    output: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
    operation: Track.distribute,
    output: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
    operation: Track.distribute(0.5),
    output: Track.make([Interval.make(-50, 100), Interval.make(50, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
    operation: Track.distribute(1),
    output: Track.make([Interval.make(-100, 100), Interval.make(0, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
    operation: Track.distribute(0, 100),
    output: Track.make([Interval.make(0, 100), Interval.make(200, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.distribute(0, 100),
    output: Track.make([Interval.make(0, 100), Interval.make(200, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
    operation: Track.distribute(0.5, 100),
    output: Track.make([Interval.make(-100, 100), Interval.make(100, 100)]),
  },
])

describeTrackOperation('distributeWithin', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.distributeWithin,
    output: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(0, 50), Interval.make(0, 100)]),
    operation: Track.distributeWithin,
    output: Track.make([Interval.make(0, 100), Interval.make(25, 50), Interval.make(0, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(0, 50), Interval.make(0, 100)]),
    operation: Track.distributeWithin(Interval.make(100, 100)),
    output: Track.make([Interval.make(100, 100), Interval.make(125, 50), Interval.make(100, 100)]),
  },
])

describe('map', () => {
  test('maps each interval with its index and the track', () => {
    const input = Track.make([Interval.make(0, 100), Interval.make(100, 100)])
    const result = Track.map(input, (ival, index, self) =>
      Interval.make(ival.start + index * self.size, ival.size),
    )
    expect(result).toEqual(Track.make([Interval.make(0, 100), Interval.make(300, 100)]))
  })

  test('data-last form', () => {
    const operation = Track.map((ival) => Interval.make(ival.start + 10, ival.size))
    expect(Track.make([Interval.make(0, 100)]).pipe(operation)).toEqual(
      Track.make([Interval.make(10, 100)]),
    )
  })
})

describeTrackOperation('mapItemStarts', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemStarts((ival, index) => ival.start + index),
    output: Track.make([Interval.make(0, 100), Interval.make(101, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemStarts(() => 0),
    output: Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
  },
])

describeTrackOperation('mapItemEnds', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemEnds((ival, index) => ival.end - index),
    output: Track.make([Interval.make(0, 100), Interval.make(99, 100)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemEnds(() => 0),
    output: Track.make([Interval.make(-100, 100), Interval.make(-100, 100)]),
  },
])

describeTrackOperation('mapItemSizes', [
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemSizes((ival, index) => ival.size + index),
    output: Track.make([Interval.make(0, 100), Interval.make(100, 101)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemSizes((ival, index) => ival.size + index * 2),
    output: Track.make([Interval.make(0, 100), Interval.make(100, 102)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemSizes(() => 0),
    output: Track.make([Interval.make(0, 0), Interval.make(100, 0)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemSizes(0),
    output: Track.make([Interval.make(0, 0), Interval.make(100, 0)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemSizes((ival) => ival.size - 50, 0.5),
    output: Track.make([Interval.make(25, 50), Interval.make(125, 50)]),
  },
  {
    input: Track.make([Interval.make(0, 100), Interval.make(100, 100)]),
    operation: Track.mapItemSizes(
      (ival) => ival.size + 50,
      (_, index) => index,
    ),
    output: Track.make([Interval.make(0, 150), Interval.make(50, 150)]),
  },
])

const dataFirstInput = () => Track.make([Interval.make(0, 100), Interval.make(100, 100)])

describe('data-first forms', () => {
  const input = dataFirstInput

  test('translate', () => {
    expect(Track.translate(input(), 10)).toEqual(
      Track.make([Interval.make(10, 100), Interval.make(110, 100)]),
    )
  })

  test('scale', () => {
    expect(Track.scale(input(), 2)).toEqual(
      Track.make([Interval.make(0, 200), Interval.make(200, 200)]),
    )
    expect(Track.scale(input(), 2, 1)).toEqual(
      Track.make([Interval.make(-200, 200), Interval.make(0, 200)]),
    )
  })

  test('scaleFrom', () => {
    expect(Track.scaleFrom(input(), 2, 100)).toEqual(
      Track.make([Interval.make(-100, 200), Interval.make(100, 200)]),
    )
  })

  test('alignItemsTo', () => {
    expect(Track.alignItemsTo(input(), 50)).toEqual(
      Track.make([Interval.make(50, 100), Interval.make(50, 100)]),
    )
    expect(Track.alignItemsTo(input(), 50, 0.5)).toEqual(
      Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
    )
  })

  test('alignItems', () => {
    expect(Track.alignItems(input(), 0.5)).toEqual(
      Track.make([Interval.make(50, 100), Interval.make(50, 100)]),
    )
    expect(Track.alignItems(input(), 0, 1)).toEqual(
      Track.make([Interval.make(-100, 100), Interval.make(-100, 100)]),
    )
  })

  test('setSize', () => {
    expect(Track.setSize(input(), 100)).toEqual(
      Track.make([Interval.make(0, 50), Interval.make(50, 50)]),
    )
    expect(Track.setSize(input(), 100, 0.5)).toEqual(
      Track.make([Interval.make(50, 50), Interval.make(100, 50)]),
    )
  })

  test('reflect', () => {
    expect(Track.reflect(input())).toEqual(
      Track.make([Interval.make(100, 100), Interval.make(0, 100)]),
    )
    expect(Track.reflect(input(), 0)).toEqual(
      Track.make([Interval.make(-100, 100), Interval.make(-200, 100)]),
    )
  })

  test('normalize', () => {
    expect(Track.normalize(input())).toEqual(
      Track.make([Interval.make(0, 0.5), Interval.make(0.5, 0.5)]),
    )
    expect(Track.normalize(input(), Interval.make(0, 400))).toEqual(
      Track.make([Interval.make(0, 0.25), Interval.make(0.25, 0.25)]),
    )
  })

  test('distribute', () => {
    expect(Track.distribute(input())).toEqual(input())
    expect(
      Track.distribute(Track.make([Interval.make(0, 100), Interval.make(0, 100)]), 0.5),
    ).toEqual(Track.make([Interval.make(-50, 100), Interval.make(50, 100)]))
    expect(Track.distribute(input(), 0, 100)).toEqual(
      Track.make([Interval.make(0, 100), Interval.make(200, 100)]),
    )
  })

  test('distributeWithin', () => {
    expect(
      Track.distributeWithin(
        Track.make([Interval.make(0, 100), Interval.make(0, 50), Interval.make(0, 100)]),
      ),
    ).toEqual(Track.make([Interval.make(0, 100), Interval.make(25, 50), Interval.make(0, 100)]))
    expect(Track.distributeWithin(input(), Interval.make(100, 100))).toEqual(
      Track.make([Interval.make(100, 100), Interval.make(100, 100)]),
    )
  })

  test('lerp', () => {
    expect(
      Track.lerp(input(), Track.make([Interval.make(50, 100), Interval.make(50, 100)]), 0.5),
    ).toEqual(Track.make([Interval.make(25, 100), Interval.make(75, 100)]))
  })

  test('mapItemStarts', () => {
    expect(Track.mapItemStarts(input(), () => 0)).toEqual(
      Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
    )
  })

  test('mapItemEnds', () => {
    expect(Track.mapItemEnds(input(), () => 0)).toEqual(
      Track.make([Interval.make(-100, 100), Interval.make(-100, 100)]),
    )
  })

  test('mapItemSizes', () => {
    expect(Track.mapItemSizes(input(), 0)).toEqual(
      Track.make([Interval.make(0, 0), Interval.make(100, 0)]),
    )
    expect(Track.mapItemSizes(input(), (ival) => ival.size - 50, 0.5)).toEqual(
      Track.make([Interval.make(25, 50), Interval.make(125, 50)]),
    )
  })
})

describe('equals', () => {
  test('per-interval equality', () => {
    expect(
      Track.equals(Track.make([Interval.make(0, 100)]), Track.make([Interval.make(0, 100)])),
    ).toBe(true)
    expect(
      Track.equals(Track.make([Interval.make(0, 100)]), Track.make([Interval.make(0, 101)])),
    ).toBe(false)
    expect(
      Track.equals(Track.make([Interval.make(0, 100)]), Track.make([Interval.make(1, 100)])),
    ).toBe(false)
  })

  test('tracks of different lengths are never equal', () => {
    expect(
      Track.equals(
        Track.make([Interval.make(0, 100)]),
        Track.make([Interval.make(0, 100), Interval.make(0, 100)]),
      ),
    ).toBe(false)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(
      Track.equals(Track.make([Interval.make(0.1 + 0.2, 1)]), Track.make([Interval.make(0.3, 1)])),
    ).toBe(true)
    expect(
      Track.equals(
        Track.make([Interval.make((0.1 + 0.2) * 1e9, 1e9)]),
        Track.make([Interval.make(0.3 * 1e9, 1e9)]),
      ),
    ).toBe(true)
  })

  test('data-last form', () => {
    expect(
      Track.make([Interval.make(0, 100)]).pipe(Track.equals(Track.make([Interval.make(0, 100)]))),
    ).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits the intervals', () => {
    expect(
      JSON.parse(JSON.stringify(Track.make([Interval.make(0, 100), Interval.make(100, 50)]))),
    ).toEqual({
      intervals: [
        { start: 0, size: 100 },
        { start: 100, size: 50 },
      ],
    })
  })
})
