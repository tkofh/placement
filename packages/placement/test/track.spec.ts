import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval'
import { type Track, scale, scaleFrom, track, translate } from '../src/track'

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
    operation: scaleFrom(2, 0),
    output: track([interval(200, 200), interval(400, 200)]),
  },
  {
    input: track([interval(0, 100), interval(200, 100)]),
    operation: scaleFrom(2, 400),
    output: track([interval(-400, 200), interval(0, 200)]),
  },
])
