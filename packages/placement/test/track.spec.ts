import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval'
import {
  type Track,
  align,
  alignTo,
  lerp,
  normalize,
  reflect,
  remap,
  scale,
  scaleFrom,
  setSize,
  setSizes,
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
    operation: alignTo(50, 1),
    output: track([interval(50, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignTo(50, 2),
    output: track([interval(50, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignTo(50, 0),
    output: track([interval(0, 100), interval(100, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignTo(50, -1),
    output: track([interval(0, 100), interval(100, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: alignTo(200, 0.5),
    output: track([interval(100, 100), interval(150, 100)]),
  },
])

describeTrackOperation('align', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(0.5),
    output: track([interval(50, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(0.5, 0.5),
    output: track([interval(25, 100), interval(75, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(0.5, 0.5, 0),
    output: track([interval(50, 100), interval(100, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(0.5, 0.5, 1),
    output: track([interval(0, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(0),
    output: track([interval(0, 100), interval(0, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(0, 0.5),
    output: track([interval(0, 100), interval(50, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(0, 0.5, 1),
    output: track([interval(-50, 100), interval(0, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(1),
    output: track([interval(100, 100), interval(100, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(1, 0.5),
    output: track([interval(50, 100), interval(100, 100)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: align(1, 0.5, 0.5),
    output: track([interval(75, 100), interval(125, 100)]),
  },
])

describeTrackOperation('setSizes', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: setSizes(200),
    output: track([interval(0, 200), interval(100, 200)]),
  },
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: setSizes(200, 0.5),
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

describeTrackOperation('lerp', [
  {
    input: track([interval(0.25, 0.25), interval(0.75, 0.25)]),
    operation: lerp(interval(0, 100)),
    output: track([interval(25, 25), interval(75, 25)]),
  },
])

describeTrackOperation('remap', [
  {
    input: track([interval(0, 100), interval(100, 100)]),
    operation: remap(interval(0, 200), interval(100, 100)),
    output: track([interval(100, 50), interval(150, 50)]),
  },
])
