import { describe, expect, test } from 'vitest'
import {
  type Interval,
  avoid,
  interval,
  lerp,
  normalize,
  remap,
  scale,
  scaleFrom,
  setEnd,
  setSize,
  setStart,
  translate,
} from '../src/interval'

interface IntervalCase {
  input: Interval
  operation: (track: Interval) => Interval
  output: Interval
}

function describeIntervalOperation(
  name: string,
  cases: ReadonlyArray<IntervalCase>,
) {
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

describeIntervalOperation('setStart', [
  {
    input: interval(0, 100),
    operation: setStart(50),
    output: interval(50, 100),
  },
  {
    input: interval(0, 100),
    operation: setStart(-50),
    output: interval(-50, 100),
  },
])

describeIntervalOperation('setSize', [
  {
    input: interval(0, 100),
    operation: setSize(50),
    output: interval(0, 50),
  },
  {
    input: interval(0, 100),
    operation: setSize(50, 0.5),
    output: interval(25, 50),
  },
  {
    input: interval(0, 100),
    operation: setSize(50, 1),
    output: interval(50, 50),
  },
])

describeIntervalOperation('setEnd', [
  {
    input: interval(0, 100),
    operation: setEnd(50),
    output: interval(-50, 100),
  },
  {
    input: interval(0, 100),
    operation: setEnd(-50),
    output: interval(-150, 100),
  },
])

describeIntervalOperation('translate', [
  {
    input: interval(0, 100),
    operation: translate(50),
    output: interval(50, 100),
  },
  {
    input: interval(0, 100),
    operation: translate(-50),
    output: interval(-50, 100),
  },
])

describeIntervalOperation('scale', [
  {
    input: interval(0, 100),
    operation: scale(2),
    output: interval(0, 200),
  },
  {
    input: interval(0, 100),
    operation: scale(2, 1),
    output: interval(-100, 200),
  },
])

describeIntervalOperation('scaleFrom', [
  {
    input: interval(100, 100),
    operation: scaleFrom(2, 100),
    output: interval(100, 200),
  },
  {
    input: interval(100, 100),
    operation: scaleFrom(2, 0),
    output: interval(200, 200),
  },
  {
    input: interval(100, 100),
    operation: scaleFrom(2, 200),
    output: interval(0, 200),
  },
])

describeIntervalOperation('lerp', [
  {
    input: interval(0, 100),
    operation: lerp(interval(0, 100), 0),
    output: interval(0, 100),
  },
  {
    input: interval(0, 100),
    operation: lerp(interval(100, 50), 0.5),
    output: interval(50, 75),
  },
  {
    input: interval(0, 100),
    operation: lerp(interval(100, 100), 1),
    output: interval(100, 100),
  },
])

describeIntervalOperation('normalize', [
  {
    input: interval(0, 100),
    operation: normalize(interval(0, 100)),
    output: interval(0, 1),
  },
  {
    input: interval(0, 100),
    operation: normalize(interval(100, 100)),
    output: interval(-1, 1),
  },
  {
    input: interval(25, 50),
    operation: normalize(interval(0, 100)),
    output: interval(0.25, 0.5),
  },
])

describeIntervalOperation('remap', [
  {
    input: interval(0, 100),
    operation: remap(interval(0, 100), interval(100, 100)),
    output: interval(100, 100),
  },
  {
    input: interval(0, 50),
    operation: remap(interval(100, 100), interval(0, 100)),
    output: interval(-100, 50),
  },
])

describeIntervalOperation('avoid', [
  {
    input: interval(0, 100),
    operation: avoid(50, 0),
    output: interval(-50, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(60, 0),
    output: interval(-40, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(40, 0),
    output: interval(40, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(10, 10),
    output: interval(20, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(interval(0, 100), 0),
    output: interval(-100, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(interval(0, 50), 0),
    output: interval(50, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(interval(50, 50), 0),
    output: interval(-50, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(interval(0, 10), 10),
    output: interval(20, 100),
  },
])
